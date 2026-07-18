-- =============================================================================
-- 0029_labor_schema.sql
-- Labor foundation sourced from the Toast Labor API:
--   * toast_jobs         — job definitions per location (title, default wage, tipped)
--   * toast_employees    — staff roster per location (name, email, wages, active)
--   * toast_time_entries — punch in/out records (hours + actual hourly wage) which
--                          give us true labor cost, Labor %, and sales/labor-hour.
-- Sync functions (SECURITY DEFINER) reach Toast directly via the http extension,
-- same pattern as toast_sync_location / toast_sync_menu_location. A rolling
-- backfill worker fills historical punches. All reads are RLS-scoped.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.toast_jobs (
  location_id  uuid not null references public.locations(id) on delete cascade,
  guid         uuid not null,
  title        text,
  code         text,
  default_wage numeric,
  tipped       boolean not null default false,
  deleted      boolean not null default false,
  synced_at    timestamptz not null default now(),
  primary key (location_id, guid)
);

create table if not exists public.toast_employees (
  location_id uuid not null references public.locations(id) on delete cascade,
  guid        uuid not null,            -- RestaurantUser guid (matches time entry employeeReference)
  v2_guid     uuid,
  first_name  text,
  last_name   text,
  chosen_name text,
  email       text,
  external_id text,
  deleted     boolean not null default false,
  synced_at   timestamptz not null default now(),
  primary key (location_id, guid)
);

create table if not exists public.toast_time_entries (
  location_id    uuid not null references public.locations(id) on delete cascade,
  guid           uuid not null,
  employee_guid  uuid,
  job_guid       uuid,
  business_date  date not null,
  in_at          timestamptz,
  out_at         timestamptz,
  regular_hours  numeric not null default 0,
  overtime_hours numeric not null default 0,
  hourly_wage    numeric not null default 0,
  non_cash_tips  numeric not null default 0,
  cash_tips      numeric,
  deleted        boolean not null default false,
  labor_cost     numeric generated always as (round((regular_hours + overtime_hours * 1.5) * hourly_wage, 2)) stored,
  synced_at      timestamptz not null default now(),
  primary key (location_id, guid)
);

create index if not exists toast_time_entries_loc_date_idx
  on public.toast_time_entries (location_id, business_date);

-- ---------------------------------------------------------------------------
-- RLS: managers read their locations, super admins read all, admins write.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['toast_jobs','toast_employees','toast_time_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$drop policy if exists "labor: managers read in scope" on public.%I$p$, t);
    execute format($p$create policy "labor: managers read in scope" on public.%I
      for select using (
        public.is_super_admin()
        or (public.is_manager_or_admin() and location_id in (select public.my_location_ids()))
      )$p$, t);
    execute format($p$drop policy if exists "labor: admin write" on public.%I$p$, t);
    execute format($p$create policy "labor: admin write" on public.%I
      for all using (public.is_super_admin()) with check (public.is_super_admin())$p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sync: job definitions for one location.
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_jobs_location(p_slug text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_tok text; v_guid uuid; v_loc uuid; v_host text; v_status int; v_content text; v_rows int := 0;
begin
  select id, toast_guid into v_loc, v_guid from public.locations where slug = p_slug;
  if v_guid is null then return 0; end if;
  select decrypted_secret into v_host from vault.decrypted_secrets where name = 'toast_api_host';
  v_tok := public.toast_access_token();
  select r.status, r.content into v_status, v_content
  from extensions.http(('GET', v_host||'/labor/v1/jobs',
    array[ extensions.http_header('Authorization','Bearer '||v_tok),
           extensions.http_header('Toast-Restaurant-External-ID', v_guid::text) ], null, null)::extensions.http_request) r;
  if v_status <> 200 or left(ltrim(v_content),1) <> '[' then return 0; end if;

  insert into public.toast_jobs (location_id, guid, title, code, default_wage, tipped, deleted, synced_at)
  select v_loc, (e->>'guid')::uuid, nullif(e->>'title',''), nullif(e->>'code',''),
         (e->>'defaultWage')::numeric, coalesce((e->>'tipped')::boolean, false),
         coalesce((e->>'deleted')::boolean, false), now()
  from jsonb_array_elements(v_content::jsonb) e
  on conflict (location_id, guid) do update set
    title = excluded.title, code = excluded.code, default_wage = excluded.default_wage,
    tipped = excluded.tipped, deleted = excluded.deleted, synced_at = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Sync: employee roster for one location.
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_employees_location(p_slug text)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_tok text; v_guid uuid; v_loc uuid; v_host text; v_status int; v_content text; v_rows int := 0;
begin
  select id, toast_guid into v_loc, v_guid from public.locations where slug = p_slug;
  if v_guid is null then return 0; end if;
  select decrypted_secret into v_host from vault.decrypted_secrets where name = 'toast_api_host';
  v_tok := public.toast_access_token();
  select r.status, r.content into v_status, v_content
  from extensions.http(('GET', v_host||'/labor/v1/employees',
    array[ extensions.http_header('Authorization','Bearer '||v_tok),
           extensions.http_header('Toast-Restaurant-External-ID', v_guid::text) ], null, null)::extensions.http_request) r;
  if v_status <> 200 or left(ltrim(v_content),1) <> '[' then return 0; end if;

  insert into public.toast_employees (location_id, guid, v2_guid, first_name, last_name, chosen_name, email, external_id, deleted, synced_at)
  select v_loc, (e->>'guid')::uuid, nullif(e->>'v2EmployeeGuid','')::uuid,
         nullif(e->>'firstName',''), nullif(e->>'lastName',''), nullif(e->>'chosenName',''),
         nullif(e->>'email',''), nullif(e->>'externalEmployeeId',''),
         coalesce((e->>'deleted')::boolean, false), now()
  from jsonb_array_elements(v_content::jsonb) e
  on conflict (location_id, guid) do update set
    v2_guid = excluded.v2_guid, first_name = excluded.first_name, last_name = excluded.last_name,
    chosen_name = excluded.chosen_name, email = excluded.email, external_id = excluded.external_id,
    deleted = excluded.deleted, synced_at = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Sync: punch in/out records for one location on a single business date.
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_time_entries_location(p_slug text, p_date date)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_tok text; v_guid uuid; v_loc uuid; v_host text; v_status int; v_content text; v_rows int := 0;
  v_datestr text := to_char(p_date, 'YYYYMMDD');
begin
  select id, toast_guid into v_loc, v_guid from public.locations where slug = p_slug;
  if v_guid is null then return 0; end if;
  select decrypted_secret into v_host from vault.decrypted_secrets where name = 'toast_api_host';
  v_tok := public.toast_access_token();
  select r.status, r.content into v_status, v_content
  from extensions.http(('GET', v_host||'/labor/v1/timeEntries?businessDate='||v_datestr,
    array[ extensions.http_header('Authorization','Bearer '||v_tok),
           extensions.http_header('Toast-Restaurant-External-ID', v_guid::text) ], null, null)::extensions.http_request) r;
  if v_status <> 200 or left(ltrim(v_content),1) <> '[' then return 0; end if;

  insert into public.toast_time_entries (location_id, guid, employee_guid, job_guid, business_date,
                                         in_at, out_at, regular_hours, overtime_hours, hourly_wage,
                                         non_cash_tips, cash_tips, deleted, synced_at)
  select v_loc, (e->>'guid')::uuid,
         nullif(e->'employeeReference'->>'guid','')::uuid,
         nullif(e->'jobReference'->>'guid','')::uuid,
         to_date(e->>'businessDate','YYYYMMDD'),
         nullif(e->>'inDate','')::timestamptz, nullif(e->>'outDate','')::timestamptz,
         coalesce((e->>'regularHours')::numeric, 0), coalesce((e->>'overtimeHours')::numeric, 0),
         coalesce((e->>'hourlyWage')::numeric, 0), coalesce((e->>'nonCashTips')::numeric, 0),
         (e->>'declaredCashTips')::numeric, coalesce((e->>'deleted')::boolean, false), now()
  from jsonb_array_elements(v_content::jsonb) e
  on conflict (location_id, guid) do update set
    employee_guid = excluded.employee_guid, job_guid = excluded.job_guid, business_date = excluded.business_date,
    in_at = excluded.in_at, out_at = excluded.out_at, regular_hours = excluded.regular_hours,
    overtime_hours = excluded.overtime_hours, hourly_wage = excluded.hourly_wage,
    non_cash_tips = excluded.non_cash_tips, cash_tips = excluded.cash_tips, deleted = excluded.deleted, synced_at = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Fan-outs across all Toast-linked locations.
-- ---------------------------------------------------------------------------
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
end;
$function$;

create or replace function public.toast_sync_time_entries_day(p_date date)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare r record;
begin
  for r in select slug from public.locations where toast_guid is not null loop
    perform public.toast_sync_time_entries_location(r.slug, p_date);
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Rolling backfill for historical punches (newest-first, self-unscheduling).
-- ---------------------------------------------------------------------------
create table if not exists public.toast_labor_backfill_state (
  id          integer primary key default 1,
  start_date  date not null,
  cursor_date date not null,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.toast_labor_backfill_state enable row level security;

create or replace function public.toast_labor_backfill_step(p_days integer default 4)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_cursor date; v_start date; v_active boolean; v_nloc int; i int;
begin
  if not pg_try_advisory_lock(912931) then return; end if;
  select cursor_date, start_date, active into v_cursor, v_start, v_active from public.toast_labor_backfill_state where id = 1;
  if not coalesce(v_active, false) then perform pg_advisory_unlock(912931); return; end if;
  select count(*) into v_nloc from public.locations where toast_guid is not null;
  for i in 1..p_days loop
    exit when v_cursor < v_start;
    if (select count(distinct location_id) from public.toast_time_entries where business_date = v_cursor) < v_nloc then
      perform public.toast_sync_time_entries_day(v_cursor);
    end if;
    v_cursor := v_cursor - 1;
  end loop;
  if v_cursor < v_start then
    update public.toast_labor_backfill_state set active = false, cursor_date = v_cursor, updated_at = now() where id = 1;
    perform cron.unschedule('toast-labor-backfill');
  else
    update public.toast_labor_backfill_state set cursor_date = v_cursor, updated_at = now() where id = 1;
  end if;
  perform pg_advisory_unlock(912931);
end;
$function$;

create or replace function public.toast_labor_backfill_start(p_days integer default 90)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  perform public.toast_sync_roster();
  insert into public.toast_labor_backfill_state (id, start_date, cursor_date, active)
  values (1, current_date - p_days, current_date, true)
  on conflict (id) do update set start_date = excluded.start_date, cursor_date = excluded.cursor_date, active = true, updated_at = now();
  perform cron.schedule('toast-labor-backfill', '* * * * *', $q$select public.toast_labor_backfill_step(4);$q$);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Fold labor into the scheduled recent-sync and the on-demand sync.
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_recent()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_today date := (now() at time zone 'America/New_York')::date;
begin
  perform public.toast_sync_day(v_today);
  perform public.toast_sync_day(v_today - 1);
  perform public.toast_sync_menu_day(v_today);
  perform public.toast_sync_menu_day(v_today - 1);
  perform public.toast_sync_time_entries_day(v_today);
  perform public.toast_sync_time_entries_day(v_today - 1);
  perform public.toast_sync_roster();
end;
$function$;

create or replace function public.sync_toast_now()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
set statement_timeout to '55s'
as $function$
declare v_today date := (now() at time zone 'America/New_York')::date; v_rows int := 0; r record;
begin
  if not public.is_manager_or_admin() then raise exception 'Not authorized'; end if;
  for r in select slug from public.locations where toast_guid is not null loop
    v_rows := v_rows + coalesce(public.toast_sync_location(r.slug, v_today), 0);
  end loop;
  perform public.toast_sync_menu_day(v_today);
  perform public.toast_sync_time_entries_day(v_today);
  return jsonb_build_object('date', v_today, 'hours_written', v_rows, 'synced_at', now());
end;
$function$;
