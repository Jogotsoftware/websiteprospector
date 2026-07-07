-- ============================================================================
-- 0005_activity_stats.sql — per-business activity rollups for the leads grid
--
-- Surfaces "last call", "last connect", and "call count" as sortable/filterable
-- columns. security_invoker = on so the existing allowlist RLS on the
-- underlying tables governs access to the view.
-- ============================================================================

create view business_activity_stats
with (security_invoker = on)
as
select
  b.id as business_id,
  max(a.created_at) filter (where a.event_type = 'call') as last_call_at,
  max(a.created_at) filter (
    where a.event_type = 'call'
      and a.outcome in ('contact', 'correct_contact', 'not_interested')
  ) as last_connect_at,
  count(a.id) filter (where a.event_type = 'call')::int as call_count
from businesses b
left join activities a on a.business_id = b.id
group by b.id;

grant select on business_activity_stats to authenticated;
