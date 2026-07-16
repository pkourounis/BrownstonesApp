-- =============================================================================
-- 0004_scheduling_inputs.sql
-- Inputs the AI scheduler optimizes against, beyond availability & skill:
--   (3) location peak hours — when each location is busiest
--   (4) hardcoded rules     — hard constraints / soft preferences per location
--
-- The optimizer's four parameters:
--   1. Manager-APPROVED availability   -> availability.status = 'approved' (0002)
--   2. Employee ranking (skill 1-5)    -> staff_positions.skill_level (0001)
--   3. Location peak hours             -> location_peak_hours (this file)
--   4. Hardcoded rules                 -> scheduling_rules (this file)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (3) Peak hours: recurring busy windows per location, with an intensity level.
-- The optimizer staffs more people (and higher-skilled ones) during peaks.
-- ---------------------------------------------------------------------------
create table public.location_peak_hours (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references public.locations(id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),  -- 0=Sun
  start_time      time not null,
  end_time        time not null,
  intensity       smallint not null default 2 check (intensity between 1 and 3), -- 1 light, 2 standard, 3 peak
  expected_covers integer,                                                -- optional guest forecast
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_time > start_time)
);
create index location_peak_hours_idx on public.location_peak_hours(location_id, day_of_week);

create trigger touch_location_peak_hours before update on public.location_peak_hours
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- (4) Hardcoded rules: constraints the schedule must satisfy (hard) or should
-- prefer (soft). Scoped org-wide (location_id null), per location, and/or per
-- department. `config` holds rule-specific values as JSON.
-- ---------------------------------------------------------------------------
create type public.scheduling_rule_type as enum (
  'max_hours_per_week',            -- config: { "hours": 40 }
  'max_consecutive_days',          -- config: { "days": 6 }
  'min_rest_hours_between_shifts', -- config: { "hours": 10 }  (no clopen)
  'min_staff_on_peak',             -- config: { "count": 4 }   (per department)
  'max_labor_pct',                 -- config: { "pct": 25 }
  'require_role_on_shift',         -- config: { "position": "Expo" }
  'minor_curfew',                  -- config: { "under": 18, "no_later_than": "22:00" }
  'open_coverage',                 -- config: { "position": "Server", "count": 1, "at": "open" }
  'manager_days_off',              -- config: { "days": [2] }  (0=Sun..6=Sat)
  'lead_when_manager_off',         -- config: { "position": "Server", "basis": "highest_skill" }
  'floor_manager_no_manager',      -- config: { "position": "Server", "floor_days": [1], "work_days": [2,5,6,0] }
  'custom'                         -- config: { "text": "..." }
);

create table public.scheduling_rules (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete cascade,  -- null = org-wide
  department  public.department,                                       -- null = all departments
  rule_type   public.scheduling_rule_type not null,
  config      jsonb not null default '{}'::jsonb,
  is_hard     boolean not null default true,   -- true = must satisfy, false = preference
  is_active   boolean not null default true,
  description text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index scheduling_rules_location_idx on public.scheduling_rules(location_id);

create trigger touch_scheduling_rules before update on public.scheduling_rules
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.location_peak_hours enable row level security;
alter table public.scheduling_rules    enable row level security;

-- --- location_peak_hours --- readable by anyone at the location; managers write.
create policy "peak_hours: read in scope" on public.location_peak_hours
  for select using (
    public.is_super_admin()
    or location_id in (select public.my_location_ids())
  );
create policy "peak_hours: manager insert" on public.location_peak_hours
  for insert with check (public.manages_location(location_id));
create policy "peak_hours: manager update" on public.location_peak_hours
  for update using (public.manages_location(location_id));
create policy "peak_hours: manager delete" on public.location_peak_hours
  for delete using (public.manages_location(location_id));

-- --- scheduling_rules --- managers/admins only.
-- Org-wide rules (location_id null) are super-admin only; location rules follow
-- the managing relationship.
create policy "rules: manager read in scope" on public.scheduling_rules
  for select using (
    public.is_super_admin()
    or (public.is_manager_or_admin()
        and (location_id is null or location_id in (select public.my_location_ids())))
  );
create policy "rules: write in scope" on public.scheduling_rules
  for insert with check (
    public.is_super_admin()
    or (location_id is not null and public.manages_location(location_id))
  );
create policy "rules: update in scope" on public.scheduling_rules
  for update using (
    public.is_super_admin()
    or (location_id is not null and public.manages_location(location_id))
  );
create policy "rules: delete in scope" on public.scheduling_rules
  for delete using (
    public.is_super_admin()
    or (location_id is not null and public.manages_location(location_id))
  );
