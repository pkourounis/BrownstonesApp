-- =============================================================================
-- 0007_workflows.sql
-- Time-off blackouts, 6-month reviews, and the swap / "up for grabs" model.
-- Decisions:
--   * Reviews are due every 6 months from each employee's hire_date; a review
--     re-rates the 1-5 skills and captures notes.
--   * Time-off cap of 2 approved days-off per day is scoped per location.
--   * A shift swap that breaks a rule is FLAGGED; the manager can override.
--   * "Up for grabs" pickups are GLOBAL — any employee, any location, can claim;
--     the manager still approves.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Blackout days — managers block dates from being requested off.
-- ---------------------------------------------------------------------------
create table public.time_off_blackouts (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index time_off_blackouts_loc_idx on public.time_off_blackouts(location_id, start_date);

alter table public.time_off_blackouts enable row level security;
create policy "blackouts: read in scope" on public.time_off_blackouts
  for select using (
    public.is_super_admin() or location_id in (select public.my_location_ids())
  );
create policy "blackouts: manager insert" on public.time_off_blackouts
  for insert with check (public.manages_location(location_id));
create policy "blackouts: manager update" on public.time_off_blackouts
  for update using (public.manages_location(location_id));
create policy "blackouts: manager delete" on public.time_off_blackouts
  for delete using (public.manages_location(location_id));

-- ---------------------------------------------------------------------------
-- Employee reviews — every 6 months from hire_date. Re-rates skills + notes.
-- Manager/super-admin visibility only (like skill ratings).
-- ---------------------------------------------------------------------------
create type public.review_status as enum ('scheduled', 'completed', 'skipped');

create table public.employee_reviews (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  reviewer_id    uuid references public.profiles(id) on delete set null,
  due_date       date not null,
  status         public.review_status not null default 'scheduled',
  completed_at   timestamptz,
  notes          text,
  skills_snapshot jsonb,   -- {"Server":5,"Cook":3} captured at review time
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index employee_reviews_profile_idx on public.employee_reviews(profile_id, due_date);

create trigger touch_employee_reviews before update on public.employee_reviews
  for each row execute function public.touch_updated_at();

alter table public.employee_reviews enable row level security;
create policy "reviews: manager read in scope" on public.employee_reviews
  for select using (
    public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "reviews: manager insert" on public.employee_reviews
  for insert with check (
    public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "reviews: manager update" on public.employee_reviews
  for update using (
    public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "reviews: admin delete" on public.employee_reviews
  for delete using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Swaps & "up for grabs". Extend shift_swap_requests:
--   kind='swap'   -> requested_to is a specific teammate (both keep a shift)
--   kind='pickup' -> open drop, claimable by ANY employee (global), then
--                    claimed_by is set pending manager approval
--   deviates_rules / deviation_note -> flag surfaced to the manager
-- ---------------------------------------------------------------------------
create type public.swap_kind as enum ('swap', 'pickup');

alter table public.shift_swap_requests
  add column if not exists kind public.swap_kind not null default 'swap',
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists deviates_rules boolean not null default false,
  add column if not exists deviation_note text;

-- Rework read/update policies so open pickups are globally visible/claimable.
drop policy if exists "swaps: involved + managers read" on public.shift_swap_requests;
create policy "swaps: involved, managers, or open pickup read" on public.shift_swap_requests
  for select using (
    requested_by = auth.uid()
    or requested_to = auth.uid()
    or claimed_by = auth.uid()
    or public.is_super_admin()
    or public.manages_shift(shift_id)
    -- any authenticated employee can see an open pickup (global up-for-grabs)
    or (kind = 'pickup' and status = 'pending' and auth.uid() is not null)
  );

drop policy if exists "swaps: involved or manager updates" on public.shift_swap_requests;
create policy "swaps: involved, manager, or claim open pickup" on public.shift_swap_requests
  for update using (
    requested_by = auth.uid()
    or requested_to = auth.uid()
    or claimed_by = auth.uid()
    or public.is_super_admin()
    or public.manages_shift(shift_id)
    -- claiming an open pickup
    or (kind = 'pickup' and status = 'pending' and auth.uid() is not null)
  );
