import type { Handler } from '@netlify/functions'
import { requireAllowedUser } from './_lib/auth.js'
import { getAdminClient } from './_lib/supabaseAdmin.js'
import { reserveApiCall, refundApiCall } from './_lib/budget.js'
import {
  geocodeCity,
  textSearchPage,
  placeDetails,
  type LatLng,
} from './_lib/places.js'
import { classifyWebsite, isLead } from './_lib/classify.js'

const LIMIT_MESSAGE = 'Monthly API limit reached — resets next month.'

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/**
 * Runs ONE page (up to 20 results) of the search pipeline for a single
 * category. The frontend calls this repeatedly — page by page, category by
 * category — pacing page requests with the delay Google requires before a
 * nextPageToken becomes valid. Keeping each invocation to one page keeps us
 * well under serverless time limits and lets the UI show live progress.
 *
 * Every Google call is reserved against the monthly cap BEFORE it is made;
 * if a reservation is denied, we stop immediately, persist everything found so
 * far, and report limitReached.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const user = await requireAllowedUser(event.headers.authorization)
  if (!user) return json(401, { error: 'Unauthorized' })

  let payload: {
    city?: string
    state?: string
    radiusMeters?: number
    category?: string
    pageToken?: string | null
    center?: LatLng | null
    minReviews?: number
  }
  try {
    payload = JSON.parse(event.body ?? '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { city, state, category } = payload
  if (!city || !state || !category) {
    return json(400, { error: 'city, state, and category are required' })
  }
  const radiusMeters = payload.radiusMeters ?? 0
  const minReviews = payload.minReviews ?? 0

  const admin = getAdminClient()
  const query = `${category} in ${city}, ${state}`

  let newLeads = 0
  let newRealSites = 0
  let skipped = 0
  let textSearchCalls = 0
  let detailsCalls = 0
  let limitReached = false

  try {
    // Resolve a center for the radius bias once, then thread it back to the
    // client so subsequent pages reuse it (no repeat geocoding).
    let center = payload.center ?? null
    if (!center && radiusMeters > 0) {
      center = await geocodeCity(city, state)
    }

    // --- Text Search (reserve first) ---------------------------------------
    const tsReservation = await reserveApiCall('text_search')
    if (!tsReservation.allowed) {
      return json(200, {
        newLeads: 0,
        newRealSites: 0,
        skipped: 0,
        textSearchCalls: 0,
        detailsCalls: 0,
        nextPageToken: null,
        center,
        limitReached: true,
        message: LIMIT_MESSAGE,
      })
    }
    textSearchCalls++

    let page
    try {
      page = await textSearchPage({
        query,
        center,
        radiusMeters,
        pageToken: payload.pageToken ?? null,
      })
    } catch (err) {
      // Google rejected the request (e.g. 403 / quota): no billable call
      // happened, so give the reserved slot back before surfacing the error.
      await refundApiCall('text_search')
      textSearchCalls--
      throw err
    }

    // --- Dedupe: drop place_ids we already have ----------------------------
    let newPlaceIds = page.placeIds
    if (page.placeIds.length > 0) {
      const { data: existing } = await admin
        .from('businesses')
        .select('place_id')
        .in('place_id', page.placeIds)
      const known = new Set((existing ?? []).map((r) => r.place_id))
      skipped = page.placeIds.filter((id) => known.has(id)).length
      newPlaceIds = page.placeIds.filter((id) => !known.has(id))
    }

    // --- Place Details for each new place (reserve first) ------------------
    for (const placeId of newPlaceIds) {
      const pdReservation = await reserveApiCall('place_details')
      if (!pdReservation.allowed) {
        limitReached = true
        break // stop immediately; progress so far is already persisted
      }
      detailsCalls++

      let details
      try {
        details = await placeDetails(placeId)
      } catch (err) {
        // Refund the reserved slot on a failed (non-billable) call, then stop
        // the run so a systemic error (e.g. 403) doesn't spin through places.
        await refundApiCall('place_details')
        detailsCalls--
        throw err
      }
      const tier = classifyWebsite(details.websiteUri)

      // Optional min-review gate at ingest time (still stored either way? No:
      // spec's min-review filter is primarily a view filter, but the search
      // form also offers it, so we honor it here to avoid ingesting noise).
      if (minReviews > 0 && details.reviewCount < minReviews) {
        continue
      }

      const { data: inserted, error: insertErr } = await admin
        .from('businesses')
        .upsert(
          {
            place_id: details.placeId,
            name: details.name,
            address: details.address,
            phone: details.phone,
            category,
            rating: details.rating,
            review_count: details.reviewCount,
            website_uri: details.websiteUri,
            website_tier: tier,
            google_maps_uri: details.googleMapsUri,
          },
          { onConflict: 'place_id', ignoreDuplicates: true },
        )
        .select('id')
        .maybeSingle()

      if (insertErr || !inserted) {
        // Conflict from a concurrent run, or an error — treat as skipped.
        skipped++
        continue
      }

      if (isLead(tier)) {
        newLeads++
      } else {
        newRealSites++
      }
    }

    return json(200, {
      newLeads,
      newRealSites,
      skipped,
      textSearchCalls,
      detailsCalls,
      nextPageToken: limitReached ? null : page.nextPageToken,
      center,
      limitReached,
      message: limitReached ? LIMIT_MESSAGE : null,
    })
  } catch (err: any) {
    // Partial progress is already committed row-by-row above.
    return json(500, {
      error: err?.message ?? 'Search failed',
      newLeads,
      newRealSites,
      skipped,
      textSearchCalls,
      detailsCalls,
      limitReached,
    })
  }
}
