-- =============================================================================
-- 0049_week_shifts_roster_id.sql
-- week_shifts now returns roster_employee_id so the builder's edit form can
-- prefill the assigned employee when editing a draft shift.
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
    'roster_employee_id', s.roster_employee_id,
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
