-- =============================================================================
-- 0027_menu_backfill_and_sync.sql
-- Backfill worker for historical item-level sales, plus wiring the menu pull
-- into the existing recent-sync and on-demand-sync paths.
--   * toast_menu_backfill_state: single-row cursor for the rolling backfill.
--   * toast_menu_backfill_step: pulls a few days per tick, newest-first, skips
--     dates already complete for every location, unschedules itself when done.
--   * toast_menu_backfill_start(days): seed the cursor and schedule the worker.
--   * toast_sync_recent / sync_toast_now: now also refresh item-level sales.
-- =============================================================================

create table if not exists public.toast_menu_backfill_state (
  id          integer primary key default 1,
  start_date  date not null,
  cursor_date date not null,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.toast_menu_backfill_state enable row level security;
-- No policies: only SECURITY DEFINER functions touch this table.

-- ---------------------------------------------------------------------------
-- Advance the backfill cursor by p_days days (newest-first), syncing any date
-- that is not yet complete for all Toast-linked locations.
-- ---------------------------------------------------------------------------
create or replace function public.toast_menu_backfill_step(p_days integer default 3)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_cursor date; v_start date; v_active boolean; v_nloc int; i int;
begin
  if not pg_try_advisory_lock(912838) then return; end if;
  select cursor_date, start_date, active into v_cursor, v_start, v_active from public.toast_menu_backfill_state where id = 1;
  if not coalesce(v_active, false) then perform pg_advisory_unlock(912838); return; end if;
  select count(*) into v_nloc from public.locations where toast_guid is not null;
  for i in 1..p_days loop
    exit when v_cursor < v_start;
    if (select count(distinct location_id) from public.pos_item_sales where business_date = v_cursor) < v_nloc then
      perform public.toast_sync_menu_day(v_cursor);
    end if;
    v_cursor := v_cursor - 1;
  end loop;
  if v_cursor < v_start then
    update public.toast_menu_backfill_state set active = false, cursor_date = v_cursor, updated_at = now() where id = 1;
    perform cron.unschedule('toast-menu-backfill');
  else
    update public.toast_menu_backfill_state set cursor_date = v_cursor, updated_at = now() where id = 1;
  end if;
  perform pg_advisory_unlock(912838);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Seed the cursor to cover the last p_days days and schedule the worker.
-- ---------------------------------------------------------------------------
create or replace function public.toast_menu_backfill_start(p_days integer default 35)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  insert into public.toast_menu_backfill_state (id, start_date, cursor_date, active)
  values (1, current_date - p_days, current_date, true)
  on conflict (id) do update set start_date = excluded.start_date, cursor_date = excluded.cursor_date, active = true, updated_at = now();
  perform cron.schedule('toast-menu-backfill', '* * * * *', $q$select public.toast_menu_backfill_step(3);$q$);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Fold the menu pull into the scheduled recent-sync and the on-demand sync.
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
  return jsonb_build_object('date', v_today, 'hours_written', v_rows, 'synced_at', now());
end;
$function$;
