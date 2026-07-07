-- ============================================================================
-- 0006_opportunities.sql — accounts / contacts / opportunities CRM model
--
-- A "lead" (businesses row) is the ACCOUNT. Accounts have many contacts, each
-- contact can carry multiple phone numbers, accounts have many opportunities,
-- and opportunities relate to contacts (many-to-many).
-- ============================================================================

-- Multiple phone numbers per contact (in addition to the primary `phone`).
-- Array of { "label": "...", "number": "..." } objects.
alter table contacts
  add column phones jsonb not null default '[]'::jsonb;

-- Opportunity pipeline stages.
create type opportunity_stage as enum (
  'prospecting',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost'
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null,
  stage opportunity_stage not null default 'prospecting',
  amount numeric(12, 2),
  close_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunities_business_idx on opportunities (business_id);

create trigger opportunities_set_updated_at
  before update on opportunities
  for each row execute function set_updated_at();

-- Many-to-many: which contacts are attached to which opportunities.
create table opportunity_contacts (
  opportunity_id uuid not null references opportunities (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, contact_id)
);

create index opportunity_contacts_contact_idx on opportunity_contacts (contact_id);

-- RLS: allowlisted users only, same as everything else.
alter table opportunities enable row level security;
alter table opportunity_contacts enable row level security;

create policy opportunities_all on opportunities
  for all to authenticated
  using (is_allowed_user())
  with check (is_allowed_user());

create policy opportunity_contacts_all on opportunity_contacts
  for all to authenticated
  using (is_allowed_user())
  with check (is_allowed_user());
