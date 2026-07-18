-- =============================================================================
-- 0052_location_scheduling_defaults.sql
-- Move scheduling knobs onto each store (they're operational, per-location, not
-- global branding): target sales per labor-hour, weekly hour cap, shift length.
-- The Auto-fill engine reads these per store.
-- =============================================================================

alter table public.locations
  add column if not exists labor_target_splh numeric(10,2) not null default 75,
  add column if not exists weekly_hour_cap   integer not null default 40,
  add column if not exists shift_length      integer not null default 6;
