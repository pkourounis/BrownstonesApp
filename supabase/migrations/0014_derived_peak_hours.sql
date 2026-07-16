-- =============================================================================
-- 0014_derived_peak_hours.sql
-- Compute peak hours from historical Toast sales instead of hardcoding them.
--   location_hour_demand         -> avg revenue by (location, day-of-week, hour)
--                                   over a trailing 8-week window
--   location_peak_hours_derived  -> each hour's intensity (1 light / 2 standard /
--                                   3 peak) ranked against that location's own
--                                   distribution
-- The optimizer uses the DERIVED intensity by default; a manager may still pin a
-- window in location_peak_hours (manual override). Sales sync (Toast) writes
-- pos_sales; everything here is computed from it.
-- =============================================================================

-- Trailing 8 weeks of hourly revenue, averaged by day-of-week + hour.
create or replace view public.location_hour_demand as
  select
    location_id,
    extract(dow from business_date)::smallint as day_of_week,  -- 0=Sun..6=Sat
    hour,
    avg(revenue)      as avg_revenue,
    avg(transactions) as avg_transactions,
    count(*)          as sample_days
  from public.pos_sales
  where business_date >= current_date - interval '56 days'
  group by location_id, extract(dow from business_date), hour;

grant select on public.location_hour_demand to authenticated;

-- Classify each hour against the location's own distribution:
--   top third of hours   -> 3 (peak)
--   middle third         -> 2 (standard)
--   bottom third         -> 1 (light)
create or replace view public.location_peak_hours_derived as
  with ranked as (
    select
      location_id, day_of_week, hour, avg_revenue, avg_transactions, sample_days,
      percent_rank() over (partition by location_id order by avg_revenue) as pr
    from public.location_hour_demand
  )
  select
    location_id, day_of_week, hour, avg_revenue, avg_transactions, sample_days,
    case when pr >= 0.66 then 3 when pr >= 0.33 then 2 else 1 end as intensity
  from ranked;

grant select on public.location_peak_hours_derived to authenticated;
