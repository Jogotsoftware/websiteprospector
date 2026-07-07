export type WebsiteTier =
  | 'none'
  | 'facebook'
  | 'instagram'
  | 'yelp'
  | 'linktree'
  | 'google_site'
  | 'placeholder_builder'
  | 'real_site'

/**
 * Classify a Google Places `websiteUri` into a website tier.
 *
 * A business is a "lead" when the tier is anything other than `real_site`.
 * We deliberately do NOT probe custom domains for dead/parked pages — any
 * resolvable custom domain is treated as a real site (documented gap).
 */
export function classifyWebsite(uri: string | null | undefined): WebsiteTier {
  if (!uri || !uri.trim()) return 'none'

  let host: string
  try {
    host = new URL(uri).hostname.toLowerCase()
  } catch {
    // Malformed / non-URL value — treat as no usable site.
    return 'none'
  }
  const h = host.replace(/^www\./, '')

  if (h.includes('facebook.com') || h.includes('m.me')) return 'facebook'
  if (h.includes('instagram.com')) return 'instagram'
  if (h.includes('yelp.com')) return 'yelp'
  if (h.includes('linktr.ee') || h.includes('linktree.com')) return 'linktree'
  if (h.includes('business.site')) return 'google_site'
  if (
    h.includes('square.site') ||
    h.includes('weebly.com') ||
    // free-tier Wix sites live on <name>.wixsite.com subdomains
    h.endsWith('wixsite.com')
  ) {
    return 'placeholder_builder'
  }

  return 'real_site'
}

export function isLead(tier: WebsiteTier): boolean {
  return tier !== 'real_site'
}
