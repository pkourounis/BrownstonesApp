-- =============================================================================
-- 0028_insights_rpc_v3.sql
-- Insights RPC, revised to add "top_sellers": the best-selling items for the
-- selected range + store, sourced from pos_item_sales (RLS-scoped via SECURITY
-- INVOKER, same as the rest of this function). Everything else is unchanged
-- from 0025 (insights_rpc_v2).
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
-- Day-of-week is range-independent: always the last 8 weeks so all 7 days show.
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
-- Item-level top sellers for the selected range + store.
it as (
  select pis.item_name,
         round(sum(pis.units)) as units,
         round(sum(pis.net),2) as net
  from public.pos_item_sales pis, bounds
  where pis.business_date between bounds.start_d and bounds.end_d
    and (p_location is null or pis.location_id = p_location)
  group by pis.item_name
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
  'forecast', (select coalesce(jsonb_agg(jsonb_build_object('id',location_id,'proj',proj,'days',days) order by proj desc),'[]'::jsonb) from fc)
);
$$;
