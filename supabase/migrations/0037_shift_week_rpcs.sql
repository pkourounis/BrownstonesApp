-- =============================================================================
-- 0037_shift_week_rpcs.sql
-- Read + publish a store's week of shifts, with day bucketing done in ET so
-- boundary shifts land on the right calendar day. SECURITY INVOKER: existing
-- shifts RLS (read-in-scope / manager-update) governs access.
-- =============================================================================

create or replace function public.week_shifts(p_location uuid, p_monday date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'employee', nullif(trim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,'')), ''),
    'role', e.role_title,
    'wage', e.default_wage,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'break_minutes', s.break_minutes,
    'status', s.status,
    'day', (s.starts_at at time zone 'America/New_York')::date
  ) order by s.starts_at), '[]'::jsonb)
  from public.shifts s
  left join public.employees e on e.id = s.roster_employee_id
  where s.location_id = p_location
    and (s.starts_at at time zone 'America/New_York')::date >= p_monday
    and (s.starts_at at time zone 'America/New_York')::date < p_monday + 7;
$$;

create or replace function public.publish_week(p_location uuid, p_monday date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  update public.shifts set status = 'published', published_at = now()
  where location_id = p_location and status = 'draft'
    and (starts_at at time zone 'America/New_York')::date >= p_monday
    and (starts_at at time zone 'America/New_York')::date < p_monday + 7;
  get diagnostics n = row_count;
  return n;
end;
$$;
