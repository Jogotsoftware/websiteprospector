-- ============================================================================
-- 0007_function_hardening.sql — advisor-driven lockdown of function grants
--
-- - Pin search_path on remaining functions (advisor: function_search_path_mutable)
-- - reserve_api_call: service-role only. It mutates the API budget counter and
--   must never be callable from the browser (anon or authenticated).
-- - current_month_usage / is_allowed_user: authenticated only (the UI badge
--   and RLS policies need them); not anon.
-- - enforce_email_allowlist / set_updated_at: trigger-only, no RPC callers.
-- ============================================================================

alter function set_updated_at() set search_path = public;
alter function set_custom_field(uuid[], text, jsonb) set search_path = public;

revoke execute on function reserve_api_call(api_call_type, int) from public, anon, authenticated;
grant execute on function reserve_api_call(api_call_type, int) to service_role;

revoke execute on function current_month_usage() from public, anon;
grant execute on function current_month_usage() to authenticated, service_role;

revoke execute on function is_allowed_user() from public, anon;
grant execute on function is_allowed_user() to authenticated, service_role;

revoke execute on function enforce_email_allowlist() from public, anon, authenticated;

revoke execute on function set_updated_at() from public, anon, authenticated;

revoke execute on function set_custom_field(uuid[], text, jsonb) from public, anon;
grant execute on function set_custom_field(uuid[], text, jsonb) to authenticated, service_role;
