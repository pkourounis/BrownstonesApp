-- =============================================================================
-- 0017_toast_sync.sql
-- Automated Toast -> pos_sales sync, run entirely inside Postgres (the DB can
-- reach Toast via the http extension; no edge function / no egress issues).
--
--   toast_access_token()            -> OAuth token (creds read from Vault)
--   toast_sync_location(slug, date) -> pull one store's orders for a business
--                                      date, roll up to hourly net sales +
--                                      check counts, upsert into pos_sales
--   toast_sync_day(date)            -> every location with a toast_guid
--   toast_sync_recent()             -> today + yesterday (the cron entry point)
--
-- Credentials live in Supabase Vault (toast_client_id / toast_client_secret /
-- toast_api_host) — never in this source or the repo. All functions are
-- SECURITY DEFINER and admin/cron-only (EXECUTE revoked from anon/authenticated).
-- =============================================================================

create extension if not exists http with schema extensions;

-- --- OAuth: exchange Vault creds for a bearer token -------------------------
create or replace function public.toast_access_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_id text; v_secret text; v_host text; v_status int; v_content text;
begin
  select decrypted_secret into v_id     from vault.decrypted_secrets where name = 'toast_client_id';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'toast_client_secret';
  select decrypted_secret into v_host   from vault.decrypted_secrets where name = 'toast_api_host';
  if v_id is null or v_secret is null then
    raise exception 'Toast credentials not found in Vault';
  end if;

  select r.status, r.content into v_status, v_content
  from extensions.http((
    'POST',
    v_host || '/authentication/v1/authentication/login',
    array[]::extensions.http_header[],
    'application/json',
    json_build_object('clientId', v_id, 'clientSecret', v_secret, 'userAccessType', 'TOAST_MACHINE_CLIENT')::text
  )::extensions.http_request) r;

  if v_status <> 200 then
    raise exception 'Toast auth failed (HTTP %)', v_status;
  end if;
  return (v_content::jsonb) -> 'token' ->> 'accessToken';
end;
$func$;

-- --- Sync one location for one business date --------------------------------
create or replace function public.toast_sync_location(p_slug text, p_date date)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_tok text; v_guid uuid; v_loc uuid; v_host text;
  v_page int := 1; v_status int; v_content text; v_count int; v_rows int := 0;
  v_datestr text := to_char(p_date, 'YYYYMMDD');
begin
  select id, toast_guid into v_loc, v_guid from public.locations where slug = p_slug;
  if v_guid is null then return 0; end if;

  select decrypted_secret into v_host from vault.decrypted_secrets where name = 'toast_api_host';
  v_tok := public.toast_access_token();

  create temp table if not exists _toast_orders(o jsonb) on commit drop;
  delete from _toast_orders;

  loop
    select r.status, r.content into v_status, v_content
    from extensions.http((
      'GET',
      v_host || '/orders/v2/ordersBulk?businessDate=' || v_datestr || '&page=' || v_page || '&pageSize=100',
      array[
        extensions.http_header('Authorization', 'Bearer ' || v_tok),
        extensions.http_header('Toast-Restaurant-External-ID', v_guid::text)
      ], null, null)::extensions.http_request) r;

    exit when v_status <> 200 or left(ltrim(v_content), 1) <> '[';
    insert into _toast_orders select jsonb_array_elements(v_content::jsonb);
    v_count := jsonb_array_length(v_content::jsonb);
    exit when v_count < 100 or v_page >= 40;
    v_page := v_page + 1;
  end loop;

  insert into public.pos_sales (location_id, business_date, hour, revenue, transactions, source, synced_at)
  select v_loc, p_date, agg.hr, agg.revenue, agg.tx, 'toast', now()
  from (
    select extract(hour from (((o->>'paidDate')::timestamptz) at time zone 'America/New_York'))::int as hr,
           round(sum((c->>'amount')::numeric), 2) as revenue,
           count(*) as tx
    from _toast_orders,
      lateral jsonb_array_elements(o->'checks') c
    where coalesce(o->>'voided', 'false') = 'false' and (o->>'paidDate') is not null
    group by 1
  ) agg
  on conflict (location_id, business_date, hour)
  do update set revenue = excluded.revenue, transactions = excluded.transactions,
                source = 'toast', synced_at = now();

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$func$;

-- --- Sync every location for a date -----------------------------------------
create or replace function public.toast_sync_day(p_date date)
returns table(slug text, hours_written integer)
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare r record;
begin
  for r in select l.slug from public.locations l where l.toast_guid is not null order by l.slug loop
    slug := r.slug;
    hours_written := public.toast_sync_location(r.slug, p_date);
    return next;
  end loop;
end;
$func$;

-- --- Cron entry point: today + yesterday (America/New_York) ------------------
create or replace function public.toast_sync_recent()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare v_today date := (now() at time zone 'America/New_York')::date;
begin
  perform public.toast_sync_day(v_today);
  perform public.toast_sync_day(v_today - 1);
end;
$func$;

-- Admin/cron only — keep off the public REST surface.
revoke execute on function public.toast_access_token()               from public, anon, authenticated;
revoke execute on function public.toast_sync_location(text, date)    from public, anon, authenticated;
revoke execute on function public.toast_sync_day(date)               from public, anon, authenticated;
revoke execute on function public.toast_sync_recent()                from public, anon, authenticated;
