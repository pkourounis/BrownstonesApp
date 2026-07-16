-- =============================================================================
-- 0005_staffing_requirements.sql
-- Per-location coverage: how many of each role are needed on each day of the
-- week. This is the backbone the AI scheduler fills. Requirements can differ by
-- SEASON so coverage throttles up/down with how busy a location gets.
-- =============================================================================

-- Seasons let the same location carry different coverage at different times of
-- year (e.g. a busy summer vs. a slow winter). 'standard' is the baseline.
create type public.season as enum ('standard', 'spring', 'summer', 'fall', 'winter', 'holiday');

-- Restaurants open at 7am (a Server opens); store per location so it can vary.
alter table public.locations add column if not exists opens_at time not null default '07:00';

-- ---------------------------------------------------------------------------
-- Required headcount per (location, role, day-of-week, season).
-- must_cover_open = at least one of these must be scheduled at the location's
-- opening time (used for the "1 Server opens at 7am every day" rule).
-- ---------------------------------------------------------------------------
create table public.staffing_requirements (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references public.locations(id) on delete cascade,
  position_id     uuid not null references public.positions(id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),  -- 0=Sun
  season          public.season not null default 'standard',
  required_count  smallint not null check (required_count >= 0),
  must_cover_open boolean not null default false,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (location_id, position_id, day_of_week, season)
);
create index staffing_requirements_loc_idx on public.staffing_requirements(location_id, season);

create trigger touch_staffing_requirements before update on public.staffing_requirements
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row-Level Security — readable by anyone at the location; managers write.
-- ===========================================================================
alter table public.staffing_requirements enable row level security;

create policy "staffing: read in scope" on public.staffing_requirements
  for select using (
    public.is_super_admin()
    or location_id in (select public.my_location_ids())
  );
create policy "staffing: manager insert" on public.staffing_requirements
  for insert with check (public.manages_location(location_id));
create policy "staffing: manager update" on public.staffing_requirements
  for update using (public.manages_location(location_id));
create policy "staffing: manager delete" on public.staffing_requirements
  for delete using (public.manages_location(location_id));
