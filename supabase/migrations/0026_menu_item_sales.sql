-- =============================================================================
-- 0026_menu_item_sales.sql
-- Per-item sales from Toast, powering the Insights "Top sellers" section.
--   * pos_item_sales: one row per (location, business_date, item_name).
--   * toast_sync_menu_location / toast_sync_menu_day: pull item-level sales from
--     the Toast ordersBulk feed and upsert them (SECURITY DEFINER; the DB reaches
--     Toast directly via the http extension, same pattern as toast_sync_location).
-- =============================================================================

create table if not exists public.pos_item_sales (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.locations(id) on delete cascade,
  business_date date not null,
  item_name     text not null,
  units         numeric not null default 0,
  net           numeric not null default 0,
  source        text not null default 'toast',
  synced_at     timestamptz not null default now(),
  unique (location_id, business_date, item_name)
);

create index if not exists pos_item_sales_loc_date_idx
  on public.pos_item_sales (location_id, business_date);

alter table public.pos_item_sales enable row level security;

drop policy if exists "item_sales: managers read in scope" on public.pos_item_sales;
create policy "item_sales: managers read in scope" on public.pos_item_sales
  for select using (
    public.is_super_admin()
    or (public.is_manager_or_admin() and location_id in (select public.my_location_ids()))
  );

drop policy if exists "item_sales: admin write" on public.pos_item_sales;
create policy "item_sales: admin write" on public.pos_item_sales
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Pull one location's item-level sales for a single business date.
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_menu_location(p_slug text, p_date date)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_tok text; v_guid uuid; v_loc uuid; v_host text;
  v_page int := 1; v_status int; v_content text; v_count int; v_rows int := 0;
  v_datestr text := to_char(p_date, 'YYYYMMDD');
begin
  select id, toast_guid into v_loc, v_guid from public.locations where slug = p_slug;
  if v_guid is null then return 0; end if;
  select decrypted_secret into v_host from vault.decrypted_secrets where name = 'toast_api_host';
  v_tok := public.toast_access_token();
  create temp table if not exists _menu_orders(o jsonb) on commit drop;
  delete from _menu_orders;
  loop
    select r.status, r.content into v_status, v_content
    from extensions.http((
      'GET', v_host||'/orders/v2/ordersBulk?businessDate='||v_datestr||'&page='||v_page||'&pageSize=100',
      array[ extensions.http_header('Authorization','Bearer '||v_tok),
             extensions.http_header('Toast-Restaurant-External-ID', v_guid::text) ], null, null)::extensions.http_request) r;
    exit when v_status <> 200 or left(ltrim(v_content),1) <> '[';
    insert into _menu_orders select jsonb_array_elements(v_content::jsonb);
    v_count := jsonb_array_length(v_content::jsonb);
    exit when v_count < 100 or v_page >= 40;
    v_page := v_page + 1;
  end loop;

  insert into public.pos_item_sales (location_id, business_date, item_name, units, net, source, synced_at)
  select v_loc, p_date, item, units, net, 'toast', now()
  from (
    select (s->>'displayName') as item,
           round(sum(coalesce((s->>'quantity')::numeric, 1)), 2) as units,
           round(sum(coalesce((s->>'price')::numeric, 0)), 2)    as net
    from _menu_orders o,
      lateral jsonb_array_elements(o->'checks') c,
      lateral jsonb_array_elements(c->'selections') s
    where coalesce(o->>'voided','false') = 'false'
      and coalesce(s->>'selectionType','NONE') in ('NONE','')
      and (s->>'displayName') is not null and (s->>'displayName') <> ''
    group by (s->>'displayName')
  ) agg
  on conflict (location_id, business_date, item_name)
  do update set units = excluded.units, net = excluded.net, source = 'toast', synced_at = now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Pull item-level sales for every Toast-linked location on a single date.
-- ---------------------------------------------------------------------------
create or replace function public.toast_sync_menu_day(p_date date)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare r record;
begin
  for r in select slug from public.locations where toast_guid is not null loop
    perform public.toast_sync_menu_location(r.slug, p_date);
  end loop;
end;
$function$;
