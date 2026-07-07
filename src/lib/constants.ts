import type {
  ActivityOutcome,
  EventType,
  OpportunityStage,
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
  { value: 'left_voicemail', label: 'Left Voicemail', key: '2' },
  { value: 'contact', label: 'Contact', key: '3' },
  { value: 'correct_contact', label: 'Correct Contact', key: '4' },
  { value: 'not_interested', label: 'Not interested', key: '5' },
  { value: 'bad_data', label: 'Bad Data', key: '6' },
]

export const OUTCOME_LABELS: Record<ActivityOutcome, string> = Object.fromEntries(
  OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ActivityOutcome, string>

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'demo', label: 'Demo' },
]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  call: 'Call',
  meeting: 'Meeting',
  demo: 'Demo',
}

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}
