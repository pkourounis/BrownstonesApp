-- =============================================================================
-- 0022_report_views_2.sql
-- Additional reporting views (daypart, day-of-week, daily trend), all
-- SECURITY INVOKER so they inherit pos_sales RLS.
-- =============================================================================

-- Daypart: breakfast (<11) vs lunch (>=11), trailing 8 weeks.
create or replace view public.report_daypart with (security_invoker = on) as
  select location_id,
         round(sum(revenue) filter (where hour < 11), 2)  as breakfast_net,
         round(sum(revenue) filter (where hour >= 11), 2) as lunch_net
  from public.pos_sales
  where business_date >= current_date - 56
  group by location_id;
grant select on public.report_daypart to authenticated;

-- Average daily net by day-of-week, trailing 8 weeks.
create or replace view public.report_dow with (security_invoker = on) as
  with daily as (
    select location_id, business_date,
           extract(dow from business_date)::smallint as dow,
           sum(revenue) as net
    from public.pos_sales
    where business_date >= current_date - 56
    group by location_id, business_date
  )
  select location_id, dow, round(avg(net), 2) as avg_net
  from daily group by location_id, dow;
grant select on public.report_dow to authenticated;

-- Daily net, last 30 days.
create or replace view public.report_sales_daily with (security_invoker = on) as
  select location_id, business_date, round(sum(revenue), 2) as net
  from public.pos_sales
  where business_date >= current_date - 30
  group by location_id, business_date;
grant select on public.report_sales_daily to authenticated;
