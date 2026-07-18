-- =============================================================================
-- 0056_shift_role.sql
-- Per-shift role so a multi-role employee can be scheduled in different roles on
-- different days (e.g. server Friday, host Saturday). create_shift takes an
-- optional p_role; week_shifts returns the shift's role when set, else the
-- employee's default role.
-- =============================================================================

alter table public.shifts add column if not exists role_title text;

create or replace function public.create_shift(
  p_location uuid,
  p_date date,
  p_start text,
  p_end text,
  p_break integer default 0,
  p_employee uuid default null,
  p_role text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid; v_starts timestamptz; v_ends timestamptz;
begin
  v_starts := ((p_date::text || ' ' || p_start)::timestamp at time zone 'America/New_York');
  v_ends   := ((p_date::text || ' ' || p_end)::timestamp   at time zone 'America/New_York');
  if v_ends <= v_starts then v_ends := v_ends + interval '1 day'; end if;

  insert into public.shifts (location_id, roster_employee_id, starts_at, ends_at, break_minutes, status, role_title, created_by)
  values (p_location, p_employee, v_starts, v_ends, greatest(coalesce(p_break, 0), 0), 'draft', nullif(trim(coalesce(p_role,'')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

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
    'role', coalesce(nullif(trim(coalesce(s.role_title,'')), ''), e.role_title),
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
