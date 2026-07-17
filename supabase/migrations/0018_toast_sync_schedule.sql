-- =============================================================================
-- 0018_toast_sync_schedule.sql
-- Schedule the Toast -> pos_sales sync to run automatically every day.
-- Runs at 22:00 UTC (~6 PM America/New_York, after stores close) and pulls
-- today + yesterday, so late-posting orders are captured on the next pass.
-- cron.schedule upserts by job name, so re-running is idempotent.
--
-- NOTE: credentials live in Supabase Vault (see 0017); nothing secret here.
-- =============================================================================

create extension if not exists pg_cron;

select cron.schedule('toast-sales-sync', '0 22 * * *', $$select public.toast_sync_recent();$$);
