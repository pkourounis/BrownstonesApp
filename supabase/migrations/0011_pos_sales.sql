-- =============================================================================
-- 0011_pos_sales.sql
-- Sales data synced from Toast, per location per hour. Drives revenue/hour vs.
-- labor decisions and feeds the scheduler as a demand signal.
-- =============================================================================

-- Per-location threshold below which an hour is flagged for a schedule trim.
alter table public.locations
  add column if not exists revenue_per_hour_target numeric(10,2) not null default 250;

create table public.pos_sales (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.locations(id) on delete cascade,
  business_date date not null,
  hour          smallint not null check (hour between 0 and 23),
  revenue       numeric(12,2) not null default 0,
  transactions  integer not null default 0,
  source        text not null default 'toast',
  synced_at     timestamptz not null default now(),
  unique (location_id, business_date, hour)
);
create index pos_sales_loc_date_idx on public.pos_sales(location_id, business_date);

alter table public.pos_sales enable row level security;
-- Managers/admins read their location's sales; the Toast sync writes via the
-- service role (which bypasses RLS). Employees don't see sales.
create policy "pos_sales: managers read in scope" on public.pos_sales
  for select using (
    public.is_super_admin()
    or (public.is_manager_or_admin() and location_id in (select public.my_location_ids()))
  );
create policy "pos_sales: admin write" on public.pos_sales
  for all using (public.is_super_admin()) with check (public.is_super_admin());
