-- =============================================================================
-- 0033_shifts_schema.sql
-- Published schedule (future + recent shifts) from the Toast Labor API.
--   * toast_shifts: one row per scheduled shift (employee, job, in/out, date).
--   * toast_sync_shifts_location: pull a date window for one location.
--   * toast_sync_schedule: fan out across locations for [today-back, today+fwd].
-- Folded into the recent + on-demand sync. Enables scheduled-vs-actual labor.
-- RLS-scoped like the other labor tables. business_date is the ET calendar day
-- of the shift's scheduled clock-in.
-- =============================================================================

create table if not exists public.toast_shifts (
  location_id   uuid not null references public.locations(id) on delete cascade,
  guid          uuid not null,
  employee_guid uuid,
  job_guid      uuid,
  business_date date not null,
  in_at         timestamptz,
  out_at        timestamptz,
  deleted       boolean not null default false,
  synced_at     timestamptz not null default now(),
  primary key (location_id, guid)
);

create index if not exists toast_shifts_loc_date_idx
  on public.toast_shifts (location_id, business_date);

alter table public.toast_shifts enable row level security;

drop policy if exists "labor: managers read in scope" on public.toast_shifts;
create policy "labor: managers read in scope" on public.toast_shifts
  for select using (
    public.is_super_admin()
    or (public.is_manager_or_admin() and location_id in (select public.my_location_ids()))
  );

drop policy if exists "labor: admin write" on public.toast_shifts;
create policy "labor: admin write" on public.toast_shifts
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Pull scheduled shifts for one location over [p_start, p_end] (inclusive days).
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_shifts_location(p_slug text, p_start date, p_end date)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_tok text; v_guid uuid; v_loc uuid; v_host text; v_status int; v_content text; v_rows int := 0;
  v_qs text;
begin
  select id, toast_guid into v_loc, v_guid from public.locations where slug = p_slug;
  if v_guid is null then return 0; end if;
  select decrypted_secret into v_host from vault.decrypted_secrets where name = 'toast_api_host';
  v_tok := public.toast_access_token();
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '25000');
  -- ISO-8601 UTC window; %2B is the URL-encoded "+" for the +0000 offset.
  v_qs := 'startDate='||to_char(p_start,'YYYY-MM-DD')||'T00:00:00.000%2B0000'
        ||'&endDate='||to_char(p_end + 1,'YYYY-MM-DD')||'T00:00:00.000%2B0000';
  select r.status, r.content into v_status, v_content
  from extensions.http(('GET', v_host||'/labor/v1/shifts?'||v_qs,
    array[ extensions.http_header('Authorization','Bearer '||v_tok),
           extensions.http_header('Toast-Restaurant-External-ID', v_guid::text) ], null, null)::extensions.http_request) r;
  if v_status <> 200 or left(ltrim(v_content),1) <> '[' then return 0; end if;

  insert into public.toast_shifts (location_id, guid, employee_guid, job_guid, business_date, in_at, out_at, deleted, synced_at)
  select v_loc, (e->>'guid')::uuid,
         nullif(e->'employeeReference'->>'guid','')::uuid,
         nullif(e->'jobReference'->>'guid','')::uuid,
         ((e->>'inDate')::timestamptz at time zone 'America/New_York')::date,
         nullif(e->>'inDate','')::timestamptz, nullif(e->>'outDate','')::timestamptz,
         coalesce((e->>'deleted')::boolean, false), now()
  from jsonb_array_elements(v_content::jsonb) e
  where (e->>'inDate') is not null
  on conflict (location_id, guid) do update set
    employee_guid = excluded.employee_guid, job_guid = excluded.job_guid, business_date = excluded.business_date,
    in_at = excluded.in_at, out_at = excluded.out_at, deleted = excluded.deleted, synced_at = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Sync the published schedule across all locations for a rolling window.
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_schedule(p_back integer default 7, p_fwd integer default 14)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare r record; v_today date := (now() at time zone 'America/New_York')::date;
begin
  for r in select slug from public.locations where toast_guid is not null loop
    perform public.toast_sync_shifts_location(r.slug, v_today - p_back, v_today + p_fwd);
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Fold the schedule into the scheduled recent-sync and the on-demand sync.
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
  perform public.toast_sync_schedule(7, 14);
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
  perform public.toast_sync_schedule(7, 14);
  return jsonb_build_object('date', v_today, 'hours_written', v_rows, 'synced_at', now());
end;
$function$;
