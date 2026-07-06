// ZoomInfo enrichment — best-effort and NON-BLOCKING.
//
// Small local businesses match at low rates; that is expected. Any failure
// (missing creds, auth error, no match, network error) resolves to an empty
// result and never blocks the search pipeline.
//
// NOTE: ZoomInfo's API surface varies by contract/version. The auth flow
// (PKI-signed JWT -> access token) and the enrich/search endpoints below follow
// ZoomInfo's documented Enterprise API. If your account differs, adjust the
// endpoint paths / field names in this file only — nothing else depends on the
// specifics. Set ZOOMINFO_USERNAME / ZOOMINFO_CLIENT_ID / ZOOMINFO_PRIVATE_KEY
// to enable it; leave any blank to skip enrichment entirely.

import { createSign } from 'node:crypto'

const AUTH_URL = 'https://api.zoominfo.com/authenticate'
const COMPANY_ENRICH_URL = 'https://api.zoominfo.com/enrich/company'
const CONTACT_SEARCH_URL = 'https://api.zoominfo.com/search/contact'

export interface EnrichedContact {
  name: string | null
  role: string | null
  phone: string | null
  email: string | null
}

export interface EnrichmentResult {
  matched: boolean
  contacts: EnrichedContact[]
}

const EMPTY: EnrichmentResult = { matched: false, contacts: [] }

function credentials() {
  const username = process.env.ZOOMINFO_USERNAME
  const clientId = process.env.ZOOMINFO_CLIENT_ID
  const privateKey = process.env.ZOOMINFO_PRIVATE_KEY
  if (!username || !clientId || !privateKey) return null
  // Support keys pasted with literal "\n" escapes (common in env UIs).
  return { username, clientId, privateKey: privateKey.replace(/\\n/g, '\n') }
}

// Cache the access token across warm invocations.
let tokenCache: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  const creds = credentials()
  if (!creds) return null
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { typ: 'JWT', alg: 'RS256' }
  const payload = {
    aud: 'enterprise_api',
    iss: 'api-client@zoominfo.com',
    username: creds.username,
    clientId: creds.clientId,
    iat: now,
    exp: now + 300,
  }
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url')
  const signingInput = `${b64(header)}.${b64(payload)}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = signer.sign(creds.privateKey).toString('base64url')
  const clientJwt = `${signingInput}.${signature}`

  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientJwt}`,
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) return null
  const json = (await res.json()) as any
  const token: string | undefined = json?.jwt
  if (!token) return null
  tokenCache = { token, expiresAt: Date.now() + 55 * 60 * 1000 }
  return token
}

/**
 * Attempt to match a business against ZoomInfo and return any contacts found.
 * Only called for actual leads (never for real_site businesses).
 */
export async function enrichBusiness(input: {
  name: string
  address: string | null
}): Promise<EnrichmentResult> {
  try {
    const token = await getAccessToken()
    if (!token) return EMPTY

    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    // 1) Match the company.
    const companyRes = await fetch(COMPANY_ENRICH_URL, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        matchCompanyInput: [
          { companyName: input.name, companyAddress: input.address ?? undefined },
        ],
        outputFields: ['id', 'name'],
      }),
    })
    if (!companyRes.ok) return EMPTY
    const companyJson = (await companyRes.json()) as any
    const match = companyJson?.data?.result?.[0]?.data?.[0]
    const companyId = match?.id
    if (!companyId) return { matched: false, contacts: [] }

    // 2) Pull a few contacts for the matched company.
    const contactRes = await fetch(CONTACT_SEARCH_URL, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        companyId: String(companyId),
        rpp: 5,
        outputFields: ['firstName', 'lastName', 'jobTitle', 'email', 'phone'],
      }),
    })
    if (!contactRes.ok) return { matched: true, contacts: [] }
    const contactJson = (await contactRes.json()) as any
    const rows: any[] = contactJson?.data ?? []

    const contacts: EnrichedContact[] = rows.map((c) => {
      const fullName = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim()
      return {
        name: fullName || null,
        role: c?.jobTitle ?? null,
        phone: c?.phone ?? null,
        email: c?.email ?? null,
      }
    })

    return { matched: true, contacts }
  } catch {
    // Never block the pipeline on enrichment failures.
    return EMPTY
  }
}
