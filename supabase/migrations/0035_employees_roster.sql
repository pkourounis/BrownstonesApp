-- =============================================================================
-- 0035_employees_roster.sql
-- Unified, schedulable employee roster — independent of app logins.
--   * source 'toast'  : imported from the Toast roster (people who have punched),
--                       with role + wage derived from their most recent punch.
--   * source 'manual' : added directly in the app.
-- roster_import_from_toast() upserts the Toast side (by toast_employee_guid) and
-- runs inside toast_sync_roster so new hires appear automatically. Manual rows
-- (toast_employee_guid null) are never touched by the import.
-- =============================================================================

create table if not exists public.employees (
  id                  uuid primary key default gen_random_uuid(),
  location_id         uuid not null references public.locations(id) on delete cascade,
  first_name          text not null,
  last_name           text,
  email               text,
  phone               text,
  role_title          text,
  position_id         uuid references public.positions(id) on delete set null,
  default_wage        numeric,
  source              text not null default 'manual' check (source in ('toast','manual')),
  toast_employee_guid uuid,
  active              boolean not null default true,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (location_id, toast_employee_guid)
);

create index if not exists employees_location_idx on public.employees (location_id) where active;

alter table public.employees enable row level security;

drop policy if exists "roster: read in scope" on public.employees;
create policy "roster: read in scope" on public.employees
  for select using (
    public.is_super_admin()
    or (public.is_manager_or_admin() and location_id in (select public.my_location_ids()))
  );

drop policy if exists "roster: managers write in scope" on public.employees;
create policy "roster: managers write in scope" on public.employees
  for all using (public.is_super_admin() or public.manages_location(location_id))
  with check (public.is_super_admin() or public.manages_location(location_id));

-- ---------------------------------------------------------------------------
-- Import / refresh the Toast side of the roster. Only employees with punch
-- history are imported (that's the real working crew); role + wage come from
-- their latest time entry.
-- ---------------------------------------------------------------------------
create or replace function public.roster_import_from_toast()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_rows int := 0;
begin
  insert into public.employees (location_id, first_name, last_name, email, role_title, default_wage, source, toast_employee_guid, active)
  select emp.location_id,
         coalesce(nullif(emp.chosen_name,''), nullif(emp.first_name,''), 'Employee'),
         emp.last_name, emp.email, lr.title, lr.wage, 'toast', emp.guid, not emp.deleted
  from public.toast_employees emp
  join lateral (
    select j.title, t.hourly_wage as wage
    from public.toast_time_entries t
    left join public.toast_jobs j on j.location_id = t.location_id and j.guid = t.job_guid
    where t.location_id = emp.location_id and t.employee_guid = emp.guid and not t.deleted
    order by t.business_date desc, t.in_at desc
    limit 1
  ) lr on true
  on conflict (location_id, toast_employee_guid) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = coalesce(excluded.email, public.employees.email),
    role_title = coalesce(excluded.role_title, public.employees.role_title),
    default_wage = coalesce(excluded.default_wage, public.employees.default_wage),
    active = excluded.active,
    updated_at = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- Fold the roster import into the periodic roster sync.
create or replace function public.toast_sync_roster()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare r record;
begin
  for r in select slug from public.locations where toast_guid is not null loop
    perform public.toast_sync_jobs_location(r.slug);
    perform public.toast_sync_employees_location(r.slug);
  end loop;
  perform public.roster_import_from_toast();
end;
$function$;
