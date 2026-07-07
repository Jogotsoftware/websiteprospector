import { getAdminClient } from './supabaseAdmin.js'

export type ApiCallType = 'text_search' | 'place_details'

export function monthlyCap(): number {
  const raw = process.env.MONTHLY_API_CAP
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 4500
}

export interface Reservation {
  allowed: boolean
  newCount: number
}

/**
 * Atomically reserve one Google API call of the given type for the current
 * month. Returns { allowed: false } when the cap would be exceeded — the
 * caller MUST NOT make the API call in that case.
 */
export async function reserveApiCall(callType: ApiCallType): Promise<Reservation> {
  const admin = getAdminClient()
  const { data, error } = await admin.rpc('reserve_api_call', {
    p_call_type: callType,
    p_max: monthlyCap(),
  })
  if (error) {
    throw new Error(`reserve_api_call failed: ${error.message}`)
  }
  const row = Array.isArray(data) ? data[0] : data
  return { allowed: !!row?.allowed, newCount: row?.new_count ?? 0 }
}

/**
 * Give back a previously-reserved slot when the Google call did not actually
 * succeed (e.g. a 4xx/5xx error — Google does not bill for those). Keeps the
 * monthly counter aligned with real billable usage so failed attempts don't
 * burn the cap. Never drops below zero.
 */
export async function refundApiCall(callType: ApiCallType): Promise<void> {
  const admin = getAdminClient()
  // Month is derived server-side (same as reserve_api_call) to avoid any
  // client/DB month-boundary mismatch.
  await admin.rpc('refund_api_call', { p_call_type: callType })
}
