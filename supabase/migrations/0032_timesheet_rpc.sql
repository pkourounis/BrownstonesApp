-- =============================================================================
-- 0032_timesheet_rpc.sql
-- Punch in/out records for a single business date, joined to the employee roster
-- and job titles. SECURITY INVOKER, so toast_time_entries RLS scopes managers to
-- their own locations. p_date null => the most recent date with punches.
-- Returns { date, rows: [...] } ordered by location then clock-in.
-- =============================================================================

create or replace function public.timesheet(p_date date default null, p_location uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with d as (
  select coalesce(p_date, (select max(business_date) from public.toast_time_entries)) as day
)
select jsonb_build_object(
  'date', (select day from d),
  'rows', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'location_id', te.location_id,
      'employee', nullif(trim(coalesce(nullif(e.chosen_name,''), e.first_name, '') || ' ' || coalesce(e.last_name,'')), ''),
      'job', j.title,
      'tipped', coalesce(j.tipped, false),
      'in_at', te.in_at,
      'out_at', te.out_at,
      'hours', round(te.regular_hours + te.overtime_hours, 2),
      'ot_hours', te.overtime_hours,
      'wage', te.hourly_wage,
      'cost', te.labor_cost,
      'open', te.out_at is null
    ) order by te.location_id, te.in_at), '[]'::jsonb)
    from public.toast_time_entries te
    left join public.toast_employees e on e.location_id = te.location_id and e.guid = te.employee_guid
    left join public.toast_jobs j on j.location_id = te.location_id and j.guid = te.job_guid
    where te.business_date = (select day from d) and not te.deleted
      and (p_location is null or te.location_id = p_location)
  )
);
$$;
