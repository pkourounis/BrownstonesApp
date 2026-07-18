-- =============================================================================
-- 0031_insights_rpc_v4_labor.sql
-- Insights RPC, revised to add "labor" (from toast_time_entries):
--   * labor.cost  — total labor cost for the range + store
--   * labor.hours — total worked hours (regular + overtime)
--   * labor.pct   — labor cost as a % of net sales
--   * labor.splh  — net sales per labor hour
--   * labor_daily — per-day cost + hours, to chart the labor % trend
-- Everything else is unchanged from 0028 (insights_rpc_v3). SECURITY INVOKER, so
-- toast_time_entries RLS scopes managers to their locations.
-- =============================================================================

create or replace function public.insights(p_range text default 'year', p_location uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with latest as (select max(business_date) as d from public.pos_sales),
bounds as (
  select case p_range
      when 'today' then (select d from latest)
      when 'week'  then (select d from latest) - 6
      when 'month' then (select d from latest) - 29
      else (select d from latest) - 364
    end as start_d,
    (select d from latest) as end_d
),
f as (
  select ps.location_id, ps.business_date, ps.hour, ps.revenue, ps.transactions
  from public.pos_sales ps, bounds
  where ps.business_date between bounds.start_d and bounds.end_d
    and (p_location is null or ps.location_id = p_location)
),
daily as (
  select business_date, extract(dow from business_date)::int as dow,
         sum(revenue) as net, sum(transactions) as checks
  from f group by business_date
),
f56 as (
  select business_date, extract(dow from business_date)::int as dow, sum(revenue) as net
  from public.pos_sales ps
  where ps.business_date >= (select d from latest) - 55
    and (p_location is null or ps.location_id = p_location)
  group by business_date
),
lb as (
  select ps.location_id, round(sum(ps.revenue),2) as net
  from public.pos_sales ps, bounds
  where ps.business_date between bounds.start_d and bounds.end_d
  group by ps.location_id
),
it as (
  select pis.item_name,
         round(sum(pis.units)) as units,
         round(sum(pis.net),2) as net
  from public.pos_item_sales pis, bounds
  where pis.business_date between bounds.start_d and bounds.end_d
    and (p_location is null or pis.location_id = p_location)
  group by pis.item_name
),
lab as (
  select round(sum(te.labor_cost),2) as cost,
         round(sum(te.regular_hours + te.overtime_hours),2) as hours
  from public.toast_time_entries te, bounds
  where te.business_date between bounds.start_d and bounds.end_d
    and not te.deleted
    and (p_location is null or te.location_id = p_location)
),
fc as (
  select location_id,
         round(sum(forecast_revenue)) as proj,
         (select jsonb_agg(jsonb_build_object('dow', d2, 'net', n2) order by d2)
          from (select day_of_week as d2, round(sum(forecast_revenue)) as n2
                from public.location_sales_forecast s2
                where s2.location_id = s.location_id
                group by day_of_week) dd) as days
  from public.location_sales_forecast s
  where (p_location is null or s.location_id = p_location)
  group by location_id
)
select jsonb_build_object(
  'range', p_range,
  'location', p_location,
  'start_date', (select start_d from bounds),
  'latest_date', (select d from latest),
  'net', (select coalesce(round(sum(revenue),2),0) from f),
  'checks', (select coalesce(sum(transactions),0) from f),
  'by_hour', (select coalesce(jsonb_agg(jsonb_build_object('hour',hour,'net',net) order by hour),'[]'::jsonb)
              from (select hour, round(sum(revenue),2) net from f group by hour) h),
  'by_dow', (select coalesce(jsonb_agg(jsonb_build_object('dow',dow,'net',net) order by dow),'[]'::jsonb)
             from (select dow, round(avg(net),2) net from f56 group by dow) d),
  'daily', (select coalesce(jsonb_agg(jsonb_build_object('date',business_date,'net',round(net,2)) order by business_date),'[]'::jsonb)
            from daily),
  'monthly', (select coalesce(jsonb_agg(jsonb_build_object('ym',ym,'net',net) order by ym),'[]'::jsonb)
              from (select to_char(date_trunc('month',business_date),'YYYY-MM') ym, round(sum(revenue),2) net from f group by 1) m),
  'daypart', (select jsonb_build_object('breakfast',coalesce(round(sum(revenue) filter (where hour<11),2),0),
                                        'lunch',coalesce(round(sum(revenue) filter (where hour>=11),2),0)) from f),
  'leaderboard', (select coalesce(jsonb_agg(jsonb_build_object('id',location_id,'net',net) order by net desc),'[]'::jsonb) from lb),
  'top_sellers', (select coalesce(jsonb_agg(jsonb_build_object('name',item_name,'units',units,'net',net) order by net desc),'[]'::jsonb)
                  from (select item_name, units, net from it order by net desc limit 8) t),
  'labor', (select jsonb_build_object(
              'cost', coalesce(cost,0),
              'hours', coalesce(hours,0),
              'pct', case when (select coalesce(sum(revenue),0) from f) > 0
                          then round(coalesce(cost,0) / (select sum(revenue) from f) * 100, 1) else 0 end,
              'splh', case when coalesce(hours,0) > 0
                           then round((select coalesce(sum(revenue),0) from f) / hours, 2) else 0 end
            ) from lab),
  'labor_daily', (select coalesce(jsonb_agg(jsonb_build_object('date',business_date,'cost',cost,'hours',hours) order by business_date),'[]'::jsonb)
                  from (select te.business_date,
                               round(sum(te.labor_cost),2) as cost,
                               round(sum(te.regular_hours + te.overtime_hours),2) as hours
                        from public.toast_time_entries te, bounds
                        where te.business_date between bounds.start_d and bounds.end_d
                          and not te.deleted
                          and (p_location is null or te.location_id = p_location)
                        group by te.business_date) ld),
  'forecast', (select coalesce(jsonb_agg(jsonb_build_object('id',location_id,'proj',proj,'days',days) order by proj desc),'[]'::jsonb) from fc)
);
$$;
