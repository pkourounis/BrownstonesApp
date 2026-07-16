-- =============================================================================
-- 0006_season_calendar.sql
-- Maps each month of the year to a season, so staffing throttles by calendar.
-- The scheduler resolves a date's season here, then uses the matching
-- staffing_requirements rows (falling back to 'standard' for roles that don't
-- change seasonally). Only Server counts and Drink/Food Runner presence vary.
-- =============================================================================

create table public.season_calendar (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete cascade,  -- null = org-wide default
  month       smallint not null check (month between 1 and 12),
  season      public.season not null default 'standard',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (location_id, month)
);

create trigger touch_season_calendar before update on public.season_calendar
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row-Level Security — readable in scope; managers write their location,
-- super admins own the org-wide default (location_id null).
-- ===========================================================================
alter table public.season_calendar enable row level security;

create policy "season_calendar: read in scope" on public.season_calendar
  for select using (
    public.is_super_admin()
    or location_id is null
    or location_id in (select public.my_location_ids())
  );
create policy "season_calendar: write in scope" on public.season_calendar
  for insert with check (
    public.is_super_admin()
    or (location_id is not null and public.manages_location(location_id))
  );
create policy "season_calendar: update in scope" on public.season_calendar
  for update using (
    public.is_super_admin()
    or (location_id is not null and public.manages_location(location_id))
  );
create policy "season_calendar: delete in scope" on public.season_calendar
  for delete using (
    public.is_super_admin()
    or (location_id is not null and public.manages_location(location_id))
  );
