-- =============================================================================
-- 0030_labor_http_timeout.sql
-- The Toast Labor endpoints occasionally take longer than the http extension's
-- 5s default, which drops the response and skips a day's data. Raise the per-
-- request curl timeout to 25s inside each labor location-sync function. Bodies
-- are otherwise identical to 0029.
-- =============================================================================

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
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '25000');
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
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '25000');
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
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '25000');
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
