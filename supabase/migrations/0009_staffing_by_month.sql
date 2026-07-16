-- =============================================================================
-- 0009_staffing_by_month.sql
-- Switch staffing from a season abstraction to direct per-MONTH overrides.
--   month IS NULL  -> baseline coverage (applies to any month with no override)
--   month = 1..12  -> that month's override (only the roles that change: Server
--                     counts, and whether a Drink/Food Runner is needed)
-- =============================================================================

alter table public.staffing_requirements
  add column if not exists month smallint check (month between 1 and 12);

-- Dropping the season column also drops the old unique constraint that included
-- it. Baseline rows keep month = NULL.
alter table public.staffing_requirements drop column if exists season;

-- Uniqueness now keyed by month (coalesced so NULL baseline rows don't collide).
create unique index if not exists staffing_requirements_uniq
  on public.staffing_requirements (location_id, position_id, day_of_week, coalesce(month, 0));

-- The season calendar and enum are no longer needed.
drop table if exists public.season_calendar;
drop type if exists public.season;
