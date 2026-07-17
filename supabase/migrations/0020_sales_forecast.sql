-- =============================================================================
-- 0020_sales_forecast.sql
-- First sales forecast, computed from the 12-month pos_sales history.
--
--   location_sales_forecast  -> projected net revenue per (location, day-of-week,
--                               hour) for the UPCOMING week, as:
--                                 baseline (trailing 8-wk avg by dow/hour)
--                                 x recent-trend factor (last 4 wks vs prior 4)
--                                 x month-seasonality factor (target month's avg
--                                   daily net vs the location's annual avg)
--
-- Feeds the BI ("projected next week") and the AI scheduler (staff to forecast,
-- not just to yesterday). SECURITY INVOKER so it inherits pos_sales RLS.
-- =============================================================================

create or replace view public.location_sales_forecast
with (security_invoker = on) as
with baseline as (           -- trailing 8 weeks, avg by day-of-week + hour
  select location_id,
         extract(dow from business_date)::smallint as day_of_week,
         hour,
         avg(revenue) as base_rev
  from public.pos_sales
  where business_date >= current_date - 56
  group by location_id, extract(dow from business_date), hour
),
daily as (                   -- daily net per location, full history
  select location_id, business_date, sum(revenue) as net
  from public.pos_sales
  group by location_id, business_date
),
trend as (                   -- recent momentum: last 28d vs prior 28d (clamped)
  select location_id,
         greatest(0.85, least(1.20,
           coalesce(
             avg(net) filter (where business_date >= current_date - 28)
             / nullif(avg(net) filter (where business_date >= current_date - 56
                                         and business_date < current_date - 28), 0),
             1))) as trend_factor
  from daily group by location_id
),
loc_avg as (                 -- location's average daily net across the year
  select location_id, avg(net) as avg_daily_all from daily group by location_id
),
month_avg as (               -- avg daily net for the UPCOMING week's calendar month
  select location_id, avg(net) as avg_daily_month
  from daily
  where extract(month from business_date) = extract(month from (current_date + 7))
  group by location_id
)
select
  b.location_id,
  b.day_of_week,
  b.hour,
  round(
    b.base_rev
    * coalesce(t.trend_factor, 1)
    * coalesce(ma.avg_daily_month / nullif(la.avg_daily_all, 0), 1)
  , 2) as forecast_revenue,
  round(coalesce(t.trend_factor, 1), 3) as trend_factor,
  round(coalesce(ma.avg_daily_month / nullif(la.avg_daily_all, 0), 1), 3) as season_factor
from baseline b
left join trend   t  on t.location_id  = b.location_id
left join loc_avg la on la.location_id = b.location_id
left join month_avg ma on ma.location_id = b.location_id;

grant select on public.location_sales_forecast to authenticated;
