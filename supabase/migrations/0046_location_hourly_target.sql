-- =============================================================================
-- 0046_location_hourly_target.sql
-- The store-level sales-per-operating-hour goal now lives on each location
-- (locations.revenue_per_hour_target) and drives the staffing grid's on/under
-- target flag. Default bumped to $1,300/hr; existing stores left at the old
-- placeholder defaults are set to $1,300 (intentionally higher values kept).
-- =============================================================================

alter table public.locations alter column revenue_per_hour_target set default 1300;

update public.locations
  set revenue_per_hour_target = 1300
  where revenue_per_hour_target is null or revenue_per_hour_target < 1000;
