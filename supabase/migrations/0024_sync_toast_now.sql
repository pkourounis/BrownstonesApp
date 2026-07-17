-- =============================================================================
-- 0024_sync_toast_now.sql
-- On-demand Toast sync for "today", triggered from the app (Insights "Sync now"
-- button). SECURITY DEFINER so it can use the internal sync functions + Vault
-- creds, but gated to manager/admin. statement_timeout is raised to give the
-- HTTP fan-out room. The daily pg_cron job still runs regardless.
-- =============================================================================

create or replace function public.sync_toast_now()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set statement_timeout = '55s'
as $func$
declare
  v_today date := (now() at time zone 'America/New_York')::date;
  v_rows int := 0;
  r record;
begin
  if not public.is_manager_or_admin() then
    raise exception 'Not authorized';
  end if;
  for r in select slug from public.locations where toast_guid is not null loop
    v_rows := v_rows + coalesce(public.toast_sync_location(r.slug, v_today), 0);
  end loop;
  return jsonb_build_object('date', v_today, 'hours_written', v_rows, 'synced_at', now());
end;
$func$;

grant execute on function public.sync_toast_now() to authenticated;
revoke execute on function public.sync_toast_now() from anon;
