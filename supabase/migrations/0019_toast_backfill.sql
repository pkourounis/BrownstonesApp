-- =============================================================================
-- 0019_toast_backfill.sql
-- One-time historical backfill of pos_sales from Toast, run as a self-paced
-- background worker so it never trips statement timeouts or hammers the API.
--
--   toast_backfill_state         -> singleton cursor (date range + progress)
--   toast_backfill_step(n_days)  -> sync the next n_days (newest-first); when the
--                                   cursor passes the start date it marks itself
--                                   done and unschedules its own cron job
--   toast_backfill_start(months) -> seed the range and schedule the worker
--                                   (pg_cron, every minute)
--
-- Idempotent: a date already present for every location is skipped, so the job
-- is safe to restart. Newest-first so recent trends light up first.
-- =============================================================================

create table if not exists public.toast_backfill_state (
  id          int primary key default 1 check (id = 1),
  start_date  date not null,
  end_date    date not null,
  cursor_date date not null,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create or replace function public.toast_backfill_step(p_days int default 3)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $func$
declare
  v_cursor date; v_start date; v_active boolean; v_nloc int; i int;
begin
  if not pg_try_advisory_lock(912837) then return; end if;         -- no overlapping runs

  select cursor_date, start_date, active into v_cursor, v_start, v_active
  from public.toast_backfill_state where id = 1;
  if not coalesce(v_active, false) then
    perform pg_advisory_unlock(912837); return;
  end if;

  select count(*) into v_nloc from public.locations where toast_guid is not null;

  for i in 1..p_days loop
    exit when v_cursor < v_start;
    if (select count(distinct location_id) from public.pos_sales
        where business_date = v_cursor and source = 'toast') < v_nloc then
      perform public.toast_sync_day(v_cursor);
    end if;
    v_cursor := v_cursor - 1;
  end loop;

  if v_cursor < v_start then
    update public.toast_backfill_state set active = false, cursor_date = v_cursor, updated_at = now() where id = 1;
    perform cron.unschedule('toast-backfill');
  else
    update public.toast_backfill_state set cursor_date = v_cursor, updated_at = now() where id = 1;
  end if;

  perform pg_advisory_unlock(912837);
end;
$func$;

create or replace function public.toast_backfill_start(p_months int default 12)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $func$
begin
  insert into public.toast_backfill_state (id, start_date, end_date, cursor_date, active)
  values (1,
          (current_date - make_interval(months => p_months))::date,
          current_date, current_date, true)
  on conflict (id) do update
    set start_date = excluded.start_date, end_date = excluded.end_date,
        cursor_date = excluded.cursor_date, active = true, updated_at = now();
  perform cron.schedule('toast-backfill', '* * * * *', $q$select public.toast_backfill_step(3);$q$);
end;
$func$;

revoke execute on function public.toast_backfill_step(int)   from public, anon, authenticated;
revoke execute on function public.toast_backfill_start(int)  from public, anon, authenticated;

alter table public.toast_backfill_state enable row level security;  -- admin/service only; no policies
