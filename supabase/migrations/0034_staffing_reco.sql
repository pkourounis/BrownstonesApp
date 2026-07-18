-- =============================================================================
-- 0034_staffing_reco.sql
-- Staffing recommendation engine: turns historical sales-per-hour into a
-- recommended head-count, so scheduling decisions are driven by demand.
--   * stores: recommended weekly labor hours (from demand ÷ target SPLH) vs the
--     actual hours punched (trailing 8 wks), so under/over-staffed stores surface.
--   * grid:  per day-of-week × hour recommended concurrent staff for one store.
-- p_target is the target sales per labor hour (e.g. $75). SECURITY INVOKER.
-- =============================================================================

create or replace function public.staffing_reco(p_location uuid default null, p_target numeric default 75)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with tgt as (select greatest(coalesce(p_target, 75), 1) as t),
store_reco as (
  select location_id, sum(avg_revenue) / (select t from tgt) as reco_hours
  from public.location_hour_demand
  group by location_id
),
store_actual as (
  select location_id, round(sum(regular_hours + overtime_hours) / 8.0, 1) as actual_hours
  from public.toast_time_entries
  where business_date >= (current_date - 55) and not deleted
  group by location_id
)
select jsonb_build_object(
  'target', (select t from tgt),
  'stores', (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', sr.location_id,
        'reco_hours', round(sr.reco_hours, 1),
        'actual_hours', coalesce(sa.actual_hours, 0),
        'gap', round(sr.reco_hours - coalesce(sa.actual_hours, 0), 1)
      ) order by (sr.reco_hours - coalesce(sa.actual_hours, 0)) desc), '[]'::jsonb)
    from store_reco sr
    left join store_actual sa on sa.location_id = sr.location_id
  ),
  'grid', (
    select coalesce(jsonb_agg(jsonb_build_object(
        'dow', dow,
        'hour', hour,
        'rev', round(rev, 2),
        'reco', greatest(1, round(rev / (select t from tgt)))
      ) order by dow, hour), '[]'::jsonb)
    from (
      select day_of_week as dow, hour, sum(avg_revenue) as rev
      from public.location_hour_demand
      where (p_location is null or location_id = p_location)
      group by day_of_week, hour
      having sum(avg_revenue) > 0
    ) g
  )
);
$$;
