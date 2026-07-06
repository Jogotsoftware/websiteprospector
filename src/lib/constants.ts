import type {
  ActivityOutcome,
  PipelineStatus,
  WebsiteTier,
} from './types'

export const MONTHLY_API_CAP = 4500

// Default, editable category list for a search run. Not an enum — add freely.
export const DEFAULT_CATEGORIES: string[] = [
  'General contractors',
  'Handyman',
  'Home services',
  'Boutiques',
  'Retail clothing stores',
  'Salons',
  'Spas',
  'Beauty services',
  'Restaurants',
]

export const WEBSITE_TIER_LABELS: Record<WebsiteTier, string> = {
  none: 'No website',
  facebook: 'Facebook only',
  instagram: 'Instagram only',
  yelp: 'Yelp only',
  linktree: 'Linktree only',
  google_site: 'Google auto-site',
  placeholder_builder: 'Builder placeholder',
  real_site: 'Real website',
}

// Ordered best-lead-first for filter dropdowns (excludes real_site — not a lead).
export const LEAD_TIERS: WebsiteTier[] = [
  'none',
  'facebook',
  'instagram',
  'yelp',
  'linktree',
  'google_site',
  'placeholder_builder',
]

export const PIPELINE_STATUSES: PipelineStatus[] = [
  'new',
  'contacted',
  'qualified',
  'disqualified',
  'opportunity',
  'customer',
]

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
  opportunity: 'Opportunity',
  customer: 'Customer',
}

// Outcome options + their number-key shortcuts (1-7). Shown in the on-screen
// legend on the lead detail view.
export interface OutcomeOption {
  value: ActivityOutcome
  label: string
  key: string
}

export const OUTCOME_OPTIONS: OutcomeOption[] = [
  { value: 'no_answer', label: 'No answer', key: '1' },
  { value: 'left_voicemail', label: 'Left voicemail', key: '2' },
  { value: 'not_interested', label: 'Not interested', key: '3' },
  { value: 'interested', label: 'Interested', key: '4' },
  { value: 'callback_requested', label: 'Callback requested', key: '5' },
  { value: 'wrong_number', label: 'Wrong number', key: '6' },
  { value: 'disqualified', label: 'Disqualified', key: '7' },
]

export const OUTCOME_LABELS: Record<ActivityOutcome, string> = Object.fromEntries(
  OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ActivityOutcome, string>
