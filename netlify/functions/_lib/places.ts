// Google Places API (New) client.
//
// Cost control: Text Search requests ONLY place ids (cheapest field-mask tier);
// Place Details then requests exactly the fields we store. We never request
// more than we use — extra fields bump Google's billing SKU.

const PLACES_BASE = 'https://places.googleapis.com/v1'
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json'

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('Missing GOOGLE_PLACES_API_KEY env var')
  return key
}

export interface LatLng {
  latitude: number
  longitude: number
}

export interface TextSearchPage {
  placeIds: string[]
  nextPageToken: string | null
}

export interface PlaceDetails {
  placeId: string
  name: string
  address: string | null
  phone: string | null
  websiteUri: string | null
  rating: number | null
  reviewCount: number
  types: string[]
  googleMapsUri: string | null
}

/**
 * Geocode "city, state" to a center point so we can apply a real radius bias.
 * Best-effort and non-fatal: on any failure we return null and fall back to
 * text-query locality only. Uses the Geocoding API (a separate SKU from the
 * Places cap — enable it on the same key).
 */
export async function geocodeCity(
  city: string,
  state: string,
): Promise<LatLng | null> {
  try {
    const url = `${GEOCODE_BASE}?address=${encodeURIComponent(
      `${city}, ${state}`,
    )}&key=${apiKey()}`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as any
    const loc = json?.results?.[0]?.geometry?.location
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      return { latitude: loc.lat, longitude: loc.lng }
    }
    return null
  } catch {
    return null
  }
}

/**
 * One page of Text Search (up to 20 results). Requests ids only.
 * Pass the previous page's `nextPageToken` to fetch the next page — Google
 * requires a short delay before a fresh token becomes valid; the caller is
 * responsible for that delay (the frontend paces page requests).
 */
export async function textSearchPage(params: {
  query: string
  center?: LatLng | null
  radiusMeters?: number
  pageToken?: string | null
}): Promise<TextSearchPage> {
  const body: Record<string, unknown> = {
    textQuery: params.query,
    pageSize: 20,
  }
  if (params.pageToken) body.pageToken = params.pageToken
  if (params.center && params.radiusMeters && params.radiusMeters > 0) {
    body.locationBias = {
      circle: {
        center: params.center,
        radius: Math.min(params.radiusMeters, 50000), // API max 50km
      },
    }
  }

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': 'places.id,nextPageToken',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Text Search failed (${res.status}): ${text}`)
  }
  const json = (await res.json()) as any
  const placeIds: string[] = (json?.places ?? [])
    .map((p: any) => p?.id)
    .filter((id: unknown): id is string => typeof id === 'string')
  return { placeIds, nextPageToken: json?.nextPageToken ?? null }
}

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'internationalPhoneNumber',
  'websiteUri',
  'rating',
  'userRatingCount',
  'types',
  'googleMapsUri',
].join(',')

/** Fetch Place Details for a single place id (exactly the fields we store). */
export async function placeDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Place Details failed (${res.status}): ${text}`)
  }
  const p = (await res.json()) as any
  return {
    placeId,
    name: p?.displayName?.text ?? '(unknown)',
    address: p?.formattedAddress ?? null,
    phone: p?.internationalPhoneNumber ?? null,
    websiteUri: p?.websiteUri ?? null,
    rating: typeof p?.rating === 'number' ? p.rating : null,
    reviewCount: typeof p?.userRatingCount === 'number' ? p.userRatingCount : 0,
    types: Array.isArray(p?.types) ? p.types : [],
    googleMapsUri: p?.googleMapsUri ?? null,
  }
}
