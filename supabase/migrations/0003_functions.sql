-- ============================================================================
-- 0003_functions.sql — atomic API budget-cap RPC
--
-- Every Google API call must reserve a slot BEFORE it is made. This function
-- atomically increments the counter for the current month + call type and
-- refuses (allowed = false) if doing so would exceed the cap. Row-level lock
-- (FOR UPDATE) makes concurrent search runs safe.
--
-- Called only server-side with the service-role key.
-- ============================================================================

create or replace function reserve_api_call(p_call_type api_call_type, p_max int)
returns table (allowed boolean, new_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_count int;
begin
  -- Ensure the row exists, then lock it.
  insert into api_usage (month, call_type, count)
  values (v_month, p_call_type, 0)
  on conflict (month, call_type) do nothing;

  select count into v_count
  from api_usage
  where month = v_month and call_type = p_call_type
  for update;

  if v_count + 1 > p_max then
    -- Deny: would exceed the cap. Counter is left unchanged.
    return query select false, v_count;
    return;
  end if;

  update api_usage
  set count = count + 1, updated_at = now()
  where month = v_month and call_type = p_call_type
  returning count into v_count;

  return query select true, v_count;
end;
$$;

-- Convenience read: current month usage per call type (for the UI badge).
create or replace function current_month_usage()
returns table (call_type api_call_type, count int)
language sql
stable
security definer
set search_path = public
as $$
  select call_type, count
  from api_usage
  where month = to_char(now(), 'YYYY-MM');
$$;
