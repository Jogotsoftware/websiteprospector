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
  | 'not_interested'
  | 'interested'
  | 'callback_requested'
  | 'left_voicemail'
  | 'wrong_number'
  | 'disqualified'

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
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  business_id: string
  name: string | null
  role: string | null
  phone: string | null
  email: string | null
  source: ContactSource
  notes: string | null
  created_at: string
}

export interface Activity {
  id: string
  business_id: string
  logged_by: string
  outcome: ActivityOutcome
  notes: string | null
  created_at: string
}
