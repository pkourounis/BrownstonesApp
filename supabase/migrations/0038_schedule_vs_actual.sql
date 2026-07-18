-- =============================================================================
-- 0038_schedule_vs_actual.sql
-- Compare the plan against reality for a store on a business date:
--   planned = the in-app schedule (public.shifts) for that day if any exist,
--             else the synced Sling schedule (toast_shifts) as a fallback so the
--             view is useful before schedules are built here.
--   actual  = Toast punches (toast_time_entries).
-- Both sides key on the Toast employee guid, so no-shows (planned, didn't punch)
-- and unscheduled (punched, not planned) fall out of a full outer join.
-- SECURITY INVOKER; underlying-table RLS scopes managers.
-- =============================================================================

create or replace function public.schedule_vs_actual(p_location uuid, p_date date default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with d as (
  select coalesce(p_date, (select max(business_date) from public.toast_time_entries)) as day
),
inapp as (
  select e.toast_employee_guid as guid,
         nullif(trim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,'')), '') as name,
         sum(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0 - coalesce(s.break_minutes,0) / 60.0) as hours,
         min(s.starts_at) as in_at, max(s.ends_at) as out_at
  from public.shifts s
  join public.employees e on e.id = s.roster_employee_id
  where s.location_id = p_location
    and (s.starts_at at time zone 'America/New_York')::date = (select day from d)
  group by e.toast_employee_guid, nullif(trim(coalesce(e.first_name,'') || ' ' || coalesce(e.last_name,'')), '')
),
has_app as (select exists(select 1 from inapp) as v),
sling as (
  select employee_guid as guid, null::text as name,
         sum(extract(epoch from (out_at - in_at)) / 3600.0) as hours,
         min(in_at) as in_at, max(out_at) as out_at
  from public.toast_shifts
  where location_id = p_location and business_date = (select day from d) and not deleted
  group by employee_guid
),
planned as (
  select guid, name, hours, in_at, out_at from inapp
  union all
  select guid, name, hours, in_at, out_at from sling where not (select v from has_app)
),
actual as (
  select t.employee_guid as guid,
         sum(t.regular_hours + t.overtime_hours) as hours,
         min(t.in_at) as in_at, max(t.out_at) as out_at,
         sum(t.labor_cost) as cost
  from public.toast_time_entries t
  where t.location_id = p_location and t.business_date = (select day from d) and not t.deleted
  group by t.employee_guid
),
names as (
  select guid, nullif(trim(coalesce(nullif(chosen_name,''), first_name, '') || ' ' || coalesce(last_name,'')), '') as name
  from public.toast_employees where location_id = p_location
),
joined as (
  select
    coalesce(p.name, n.name, 'Unknown') as name,
    coalesce(p.hours, 0) as sched_hours, p.in_at as sched_in, p.out_at as sched_out,
    coalesce(a.hours, 0) as act_hours, a.in_at as act_in, a.out_at as act_out, coalesce(a.cost, 0) as act_cost,
    (p.guid is not null or p.name is not null) as planned,
    (a.guid is not null) as worked
  from planned p
  full outer join actual a on a.guid = p.guid
  left join names n on n.guid = coalesce(p.guid, a.guid)
)
select jsonb_build_object(
  'date', (select day from d),
  'source', case when (select v from has_app) then 'app'
                 when exists (select 1 from sling) then 'sling'
                 else 'none' end,
  'totals', jsonb_build_object(
     'sched_hours', round(coalesce((select sum(sched_hours) from joined), 0), 1),
     'act_hours',   round(coalesce((select sum(act_hours) from joined), 0), 1),
     'act_cost',    round(coalesce((select sum(act_cost) from joined), 0), 2),
     'noshow',      (select count(*) from joined where planned and not worked),
     'unscheduled', (select count(*) from joined where worked and not planned)
  ),
  'rows', (select coalesce(jsonb_agg(jsonb_build_object(
     'name', name,
     'sched_hours', round(sched_hours, 1), 'sched_in', sched_in, 'sched_out', sched_out,
     'act_hours', round(act_hours, 1), 'act_in', act_in, 'act_out', act_out, 'act_cost', round(act_cost, 2),
     'planned', planned, 'worked', worked
   ) order by planned desc, act_hours desc, name), '[]'::jsonb) from joined)
);
$$;
