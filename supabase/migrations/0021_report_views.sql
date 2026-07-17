-- =============================================================================
-- 0021_report_views.sql
-- Reporting views that power the in-app Insights page. All SECURITY INVOKER so
-- they inherit pos_sales RLS: super admin sees all stores, a manager sees only
-- their location(s), employees see nothing.
-- =============================================================================

-- Monthly net sales per location (last ~13 months).
create or replace view public.report_sales_monthly with (security_invoker = on) as
  select location_id,
         to_char(date_trunc('month', business_date), 'YYYY-MM') as ym,
         round(sum(revenue), 2) as net,
         sum(transactions)      as checks
  from public.pos_sales
  where business_date >= (date_trunc('month', current_date) - interval '12 months')
  group by location_id, date_trunc('month', business_date);

grant select on public.report_sales_monthly to authenticated;

-- Sales by hour for the most recent business date in view.
create or replace view public.report_sales_by_hour with (security_invoker = on) as
  with latest as (select max(business_date) as d from public.pos_sales)
  select ps.location_id,
         (select d from latest) as business_date,
         ps.hour,
         round(sum(ps.revenue), 2) as revenue,
         sum(ps.transactions)      as checks
  from public.pos_sales ps
  where ps.business_date = (select d from latest)
  group by ps.location_id, ps.hour;

grant select on public.report_sales_by_hour to authenticated;

-- Headline totals per location: latest day + trailing 12 months.
create or replace view public.report_sales_totals with (security_invoker = on) as
  with latest as (select max(business_date) as d from public.pos_sales)
  select ps.location_id,
         (select d from latest) as latest_date,
         round(sum(ps.revenue) filter (where ps.business_date = (select d from latest)), 2) as latest_net,
         round(sum(ps.revenue) filter (where ps.business_date >= current_date - 365), 2)     as ytd_net,
         coalesce(sum(ps.transactions) filter (where ps.business_date >= current_date - 365), 0) as ytd_checks
  from public.pos_sales ps
  group by ps.location_id;

grant select on public.report_sales_totals to authenticated;

-- Next-week forecast rolled up to a single number per location.
create or replace view public.report_forecast_weekly with (security_invoker = on) as
  select location_id, round(sum(forecast_revenue)) as projected_week
  from public.location_sales_forecast
  group by location_id;

grant select on public.report_forecast_weekly to authenticated;
