-- ============================================================================
-- 0001_schema.sql — enums, tables, indexes
-- ============================================================================

-- Enums -----------------------------------------------------------------------

create type website_tier as enum (
  'none',
  'facebook',
  'instagram',
  'yelp',
  'linktree',
  'google_site',
  'placeholder_builder',
  'real_site'
);

create type pipeline_status as enum (
  'new',
  'contacted',
  'qualified',
  'disqualified',
  'opportunity',
  'customer'
);

create type contact_source as enum (
  'zoominfo',
  'manual'
);

create type activity_outcome as enum (
  'no_answer',
  'not_interested',
  'interested',
  'callback_requested',
  'left_voicemail',
  'wrong_number',
  'disqualified'
);

create type api_call_type as enum (
  'text_search',
  'place_details'
);

-- updated_at helper -----------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- businesses ------------------------------------------------------------------

create table businesses (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,           -- dedupe key against Google Places
  name text not null,
  address text,
  phone text,
  category text,                            -- the search category it came from
  rating numeric(2,1),
  review_count int not null default 0,      -- default sort / filter key
  website_uri text,
  website_tier website_tier not null,
  google_maps_uri text,
  pipeline_status pipeline_status not null default 'new',
  disqualify_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_review_count_idx on businesses (review_count desc);
create index businesses_tier_idx on businesses (website_tier);
create index businesses_status_idx on businesses (pipeline_status);
create index businesses_category_idx on businesses (category);

create trigger businesses_set_updated_at
  before update on businesses
  for each row execute function set_updated_at();

-- contacts --------------------------------------------------------------------

create table contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text,
  role text,
  phone text,
  email text,
  source contact_source not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

create index contacts_business_idx on contacts (business_id);

-- activities ------------------------------------------------------------------

create table activities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  logged_by text not null,                  -- email of the user who logged it
  outcome activity_outcome not null,
  notes text,
  created_at timestamptz not null default now()
);

create index activities_business_idx on activities (business_id, created_at desc);

-- api_usage -------------------------------------------------------------------

create table api_usage (
  id uuid primary key default gen_random_uuid(),
  month text not null,                      -- e.g. '2026-07'
  call_type api_call_type not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  unique (month, call_type)
);
