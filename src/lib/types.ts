export type WebsiteTier =
  | 'none'
  | 'facebook'
  | 'instagram'
  | 'yelp'
  | 'linktree'
  | 'google_site'
  | 'placeholder_builder'
  | 'real_site'

export type PipelineStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'disqualified'
  | 'opportunity'
  | 'customer'

export type ContactSource = 'zoominfo' | 'manual'

export type ActivityOutcome =
  | 'no_answer'
  | 'left_voicemail'
  | 'contact'
  | 'correct_contact'
  | 'not_interested'
  | 'bad_data'

export interface Business {
  id: string
  place_id: string
  name: string
  address: string | null
  phone: string | null
  category: string | null
  rating: number | null
  review_count: number
  website_uri: string | null
  website_tier: WebsiteTier
  google_maps_uri: string | null
  pipeline_status: PipelineStatus
  disqualify_reason: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
  // Derived, merged in from business_activity_stats (not stored on the row).
  last_call_at?: string | null
  last_connect_at?: string | null
  call_count?: number
}

export type CustomFieldType = 'text' | 'number' | 'boolean' | 'date' | 'select'

export interface CustomFieldDef {
  id: string
  key: string
  label: string
  type: CustomFieldType
  options: string[]
  created_at: string
}

export interface Phone {
  label: string
  number: string
}

export interface Contact {
  id: string
  business_id: string
  name: string | null
  role: string | null
  phone: string | null // primary line
  phones: Phone[] // additional numbers
  email: string | null
  source: ContactSource
  notes: string | null
  created_at: string
}

export type OpportunityStage =
  | 'prospecting'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost'

export interface Opportunity {
  id: string
  business_id: string
  name: string
  stage: OpportunityStage
  amount: number | null
  close_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OpportunityContact {
  opportunity_id: string
  contact_id: string
  role: string | null
  created_at: string
}

export type EventType = 'call' | 'meeting' | 'demo'

export interface Activity {
  id: string
  business_id: string
  logged_by: string
  event_type: EventType
  outcome: ActivityOutcome | null
  notes: string | null
  created_at: string
}
