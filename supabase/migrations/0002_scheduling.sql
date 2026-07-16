-- =============================================================================
-- 0002_scheduling.sql
-- Availability, shifts, time-off, and shift swaps.
--
-- Scope rules (via RLS):
--   employee — reads their own shifts + published shifts at their location(s);
--              manages their own availability and time-off requests
--   manager  — full read/write for shifts, availability, time-off at the
--              location(s) they manage
--   super_admin — everything
-- =============================================================================

create type public.shift_status as enum ('draft', 'published');
create type public.request_status as enum ('pending', 'approved', 'denied', 'cancelled');

-- ---------------------------------------------------------------------------
-- Weekly recurring availability. day_of_week: 0 = Sunday .. 6 = Saturday.
-- A row means "available during this window"; absence of a row for a day
-- means not generally available.
-- ---------------------------------------------------------------------------
-- Availability must be MANAGER-APPROVED before the AI scheduler will use it
-- (scheduling parameter #1). An employee submits windows (status 'pending');
-- a manager approves or denies. Only 'approved' windows count as bookable.
create table public.availability (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  is_available boolean not null default true,
  status       public.request_status not null default 'pending',
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  note         text,
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);
create index availability_profile_idx on public.availability(profile_id);

-- ---------------------------------------------------------------------------
-- Shifts. An unassigned shift (employee_id is null) is an "open" shift that
-- the schedule optimizer or a manager can fill.
-- ---------------------------------------------------------------------------
create table public.shifts (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.locations(id) on delete cascade,
  position_id   uuid references public.positions(id) on delete set null,
  employee_id   uuid references public.profiles(id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  break_minutes integer not null default 0,
  status        public.shift_status not null default 'draft',
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index shifts_location_time_idx on public.shifts(location_id, starts_at);
create index shifts_employee_time_idx on public.shifts(employee_id, starts_at);

create trigger touch_shifts before update on public.shifts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Time-off / day-off requests.
-- ---------------------------------------------------------------------------
create table public.time_off_requests (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  status      public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index time_off_profile_idx on public.time_off_requests(profile_id);

-- ---------------------------------------------------------------------------
-- Shift swap / drop requests. If requested_to is null it is an open drop that
-- any eligible teammate can pick up (subject to manager approval).
-- ---------------------------------------------------------------------------
create table public.shift_swap_requests (
  id           uuid primary key default gen_random_uuid(),
  shift_id     uuid not null references public.shifts(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_to uuid references public.profiles(id) on delete set null,
  status       public.request_status not null default 'pending',
  note         text,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index swap_shift_idx on public.shift_swap_requests(shift_id);

-- ---------------------------------------------------------------------------
-- Helper: does the current user manage the location a shift belongs to?
-- ---------------------------------------------------------------------------
create or replace function public.manages_shift(target_shift uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.shifts s
    where s.id = target_shift and public.manages_location(s.location_id)
  );
$$;

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.availability        enable row level security;
alter table public.shifts              enable row level security;
alter table public.time_off_requests   enable row level security;
alter table public.shift_swap_requests enable row level security;

-- --- availability ---
create policy "availability: owner + managers read" on public.availability
  for select using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or public.shares_location(profile_id) and public.is_manager_or_admin()
  );
create policy "availability: owner writes" on public.availability
  for insert with check (profile_id = auth.uid());
-- Owner edits their own windows; managers/admins approve or deny (set status).
create policy "availability: owner or manager updates" on public.availability
  for update using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "availability: owner deletes" on public.availability
  for delete using (profile_id = auth.uid() or public.is_super_admin());

-- --- shifts ---
-- Employees: their own shifts, plus published shifts at their location.
-- Managers/admin: everything in their scope.
create policy "shifts: read in scope" on public.shifts
  for select using (
    employee_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and location_id in (select public.my_location_ids()))
    or (status = 'published' and location_id in (select public.my_location_ids()))
  );
create policy "shifts: manager insert" on public.shifts
  for insert with check (public.manages_location(location_id));
create policy "shifts: manager update" on public.shifts
  for update using (public.manages_location(location_id));
create policy "shifts: manager delete" on public.shifts
  for delete using (public.manages_location(location_id));

-- --- time_off_requests ---
create policy "time_off: owner + managers read" on public.time_off_requests
  for select using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "time_off: owner creates" on public.time_off_requests
  for insert with check (profile_id = auth.uid());
-- Owner can cancel their own; managers can approve/deny for their staff.
create policy "time_off: owner or manager updates" on public.time_off_requests
  for update using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "time_off: owner or admin deletes" on public.time_off_requests
  for delete using (profile_id = auth.uid() or public.is_super_admin());

-- --- shift_swap_requests ---
create policy "swaps: involved + managers read" on public.shift_swap_requests
  for select using (
    requested_by = auth.uid()
    or requested_to = auth.uid()
    or public.is_super_admin()
    or public.manages_shift(shift_id)
  );
create policy "swaps: employee creates own" on public.shift_swap_requests
  for insert with check (requested_by = auth.uid());
create policy "swaps: involved or manager updates" on public.shift_swap_requests
  for update using (
    requested_by = auth.uid()
    or requested_to = auth.uid()
    or public.is_super_admin()
    or public.manages_shift(shift_id)
  );
create policy "swaps: creator or admin deletes" on public.shift_swap_requests
  for delete using (requested_by = auth.uid() or public.is_super_admin());
