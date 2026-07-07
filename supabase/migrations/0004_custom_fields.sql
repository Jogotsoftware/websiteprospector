-- ============================================================================
-- 0004_custom_fields.sql — user-defined custom fields on businesses
--
-- Custom fields are stored in a JSONB column on `businesses`; their definitions
-- (label, type, options) live in `custom_field_defs`. This lets the leads grid
-- add, sort, filter, and inline/bulk-edit arbitrary fields without schema
-- changes per field.
-- ============================================================================

alter table businesses
  add column custom_fields jsonb not null default '{}'::jsonb;

create table custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- stable slug used as the jsonb key
  label text not null,                      -- display name
  type text not null
    check (type in ('text', 'number', 'boolean', 'date', 'select')),
  options jsonb not null default '[]'::jsonb, -- allowed values for 'select'
  created_at timestamptz not null default now()
);

alter table custom_field_defs enable row level security;

create policy custom_field_defs_all on custom_field_defs
  for all to authenticated
  using (is_allowed_user())
  with check (is_allowed_user());

-- Set one custom field to the same value across many businesses (bulk edit) or
-- a single business (inline edit). SECURITY INVOKER, so RLS on `businesses`
-- governs who may write. Passing a JSON null clears the field.
create or replace function set_custom_field(p_ids uuid[], p_key text, p_value jsonb)
returns void
language sql
as $$
  update businesses
  set custom_fields = custom_fields || jsonb_build_object(p_key, p_value)
  where id = any(p_ids);
$$;
