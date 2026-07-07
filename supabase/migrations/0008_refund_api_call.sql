-- ============================================================================
-- 0008_refund_api_call.sql — give back a reserved slot on a failed Google call
--
-- Google does not bill for 4xx/5xx responses, so a failed Text Search / Place
-- Details call should not consume the monthly cap. The search function calls
-- this to decrement the current-month counter (never below zero) when a call
-- throws. Service-role only, matching reserve_api_call.
-- ============================================================================

create or replace function refund_api_call(p_call_type api_call_type)
returns void
language sql
security definer
set search_path = public
as $$
  update api_usage
  set count = greatest(count - 1, 0), updated_at = now()
  where month = to_char(now(), 'YYYY-MM') and call_type = p_call_type;
$$;

revoke execute on function refund_api_call(api_call_type) from public, anon, authenticated;
grant execute on function refund_api_call(api_call_type) to service_role;
