-- =============================================================================
-- 0058_labor_target_default_130.sql
-- The $75/labor-hr default over-recommended staffing (e.g. 127h/day). Raise the
-- per-store Sales/labor-hour target to a realistic $130 so recommendations and
-- the coverage strips read sensibly. Existing stores left at the low default
-- are bumped; intentionally-set higher values are kept.
-- =============================================================================

alter table public.locations alter column labor_target_splh set default 130;
update public.locations set labor_target_splh = 130 where labor_target_splh is null or labor_target_splh <= 80;
