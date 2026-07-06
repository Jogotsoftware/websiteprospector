-- ============================================================================
-- 0002_rls.sql — allowlist + Row Level Security
--
-- Access is locked to an allowlist of exactly the two authorized users.
-- Defense in depth:
--   1. allowed_emails table is the single source of truth.
--   2. A signup trigger BLOCKS any auth.users row whose email isn't allowlisted
--      (rejected at the auth layer, before a session ever exists).
--   3. RLS policies on every table require the JWT email to be allowlisted.
--
-- IMPORTANT: emails are intentionally NOT committed to the repo. After running
-- these migrations, seed the two real addresses (see README, "Seed the
-- allowlist"). Until then, nobody can sign in — which is the safe default.
-- ============================================================================

create table allowed_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Helper: is the *current* authenticated user allowlisted?
create or replace function is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- --- Auth-layer enforcement --------------------------------------------------
-- Reject any signup whose email is not on the allowlist. Runs before the
-- auth.users row is committed, so a non-allowlisted address can never obtain
-- a session even if RLS were somehow bypassed.
create or replace function enforce_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from allowed_emails where lower(email) = lower(new.email)
  ) then
    raise exception 'Email % is not authorized for this application', new.email
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger enforce_email_allowlist_on_signup
  before insert on auth.users
  for each row execute function enforce_email_allowlist();

-- --- RLS ----------------------------------------------------------------------

alter table businesses     enable row level security;
alter table contacts       enable row level security;
alter table activities     enable row level security;
alter table api_usage      enable row level security;
alter table allowed_emails enable row level security;

-- businesses: allowlisted users have full read/write.
create policy businesses_all on businesses
  for all to authenticated
  using (is_allowed_user())
  with check (is_allowed_user());

-- contacts
create policy contacts_all on contacts
  for all to authenticated
  using (is_allowed_user())
  with check (is_allowed_user());

-- activities
create policy activities_all on activities
  for all to authenticated
  using (is_allowed_user())
  with check (is_allowed_user());

-- api_usage: readable by allowlisted users (the UI shows the live counter).
-- Writes happen server-side via the service-role key (bypasses RLS), so no
-- write policy is granted to normal users.
create policy api_usage_read on api_usage
  for select to authenticated
  using (is_allowed_user());

-- allowed_emails: allowlisted users may read the roster; no client writes.
create policy allowed_emails_read on allowed_emails
  for select to authenticated
  using (is_allowed_user());
