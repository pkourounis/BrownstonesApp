-- =============================================================================
-- 0061_import_toast_schedule.sql
-- Fold the Toast-published schedule into the app schedule for every store, and
-- keep it current by calling it from the recurring sync. One-time run on apply
-- backfills East Northport + any previously-missed shifts. Idempotent.
-- =============================================================================

create or replace function public.import_toast_schedule()
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_rows int;
begin
  insert into public.shifts (location_id, roster_employee_id, starts_at, ends_at, break_minutes, status)
  select t.location_id, e.id, t.in_at, t.out_at, 0, 'published'
  from public.toast_shifts t
  join public.employees e on e.toast_employee_guid = t.employee_guid and e.location_id = t.location_id
  where not t.deleted and t.in_at is not null and t.out_at is not null
    and not exists (
      select 1 from public.shifts s
      where s.location_id = t.location_id and s.roster_employee_id = e.id and s.starts_at = t.in_at
    );
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Recurring sync now folds the published schedule into the app schedule.
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
  perform public.import_toast_schedule();
end;
$function$;
