-- =============================================================================
-- 0008_locations_and_resources.sql
-- Super Admin capabilities: fuller location setup, per-day business hours, and
-- a publishing system for products/training/compliance/links with per-employee
-- sign-off tracking.
--   * Only super admins publish resources (RLS).
--   * Resources target any/all locations and/or specific employees.
--   * Compliance docs (requires_signoff) record who acknowledged and when.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Location setup fields (address, phone, opens_at already exist).
-- ---------------------------------------------------------------------------
alter table public.locations
  add column if not exists location_number text,
  add column if not exists seats integer,
  add column if not exists tables integer;

-- Per-day business hours. is_closed marks a day the location doesn't open.
create table public.location_hours (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0=Sun
  open_time   time,
  close_time  time,
  is_closed   boolean not null default false,
  unique (location_id, day_of_week),
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);

alter table public.location_hours enable row level security;
create policy "location_hours: read in scope" on public.location_hours
  for select using (
    public.is_super_admin() or location_id in (select public.my_location_ids())
  );
create policy "location_hours: manager write" on public.location_hours
  for insert with check (public.manages_location(location_id));
create policy "location_hours: manager update" on public.location_hours
  for update using (public.manages_location(location_id));
create policy "location_hours: manager delete" on public.location_hours
  for delete using (public.manages_location(location_id));

-- ---------------------------------------------------------------------------
-- Resources: things a Super Admin publishes.
--   product    — announcement of a new menu item (title, description, image)
--   training   — training module / doc
--   compliance — policy requiring sign-off
--   link       — a URL (payroll, uniform ordering, …)
--   document   — an uploaded file
-- ---------------------------------------------------------------------------
create type public.resource_type as enum ('product', 'training', 'compliance', 'link', 'document');

create table public.resources (
  id               uuid primary key default gen_random_uuid(),
  type             public.resource_type not null,
  title            text not null,
  description      text,
  url              text,          -- link, image, or file URL
  requires_signoff boolean not null default false,
  is_active        boolean not null default true,
  published_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger touch_resources before update on public.resources
  for each row execute function public.touch_updated_at();

-- Targeting: a resource can have many assignment rows.
--   (location_id null, profile_id null) -> everyone, everywhere
--   (location_id X,   profile_id null) -> everyone at location X
--   (location_id null, profile_id P)    -> just person P
--   (location_id X,   profile_id P)     -> person P (at location X)
create table public.resource_assignments (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index resource_assignments_resource_idx on public.resource_assignments(resource_id);

-- Sign-off audit trail (one row per employee acknowledgement).
create table public.resource_signoffs (
  resource_id uuid not null references public.resources(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  signed_at   timestamptz not null default now(),
  primary key (resource_id, profile_id)
);

-- SECURITY DEFINER: can the current user see this resource? (bypasses RLS so
-- the resources SELECT policy can consult assignments cleanly.)
create or replace function public.can_view_resource(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.resource_assignments ra
    where ra.resource_id = rid
      and (ra.location_id is null or ra.location_id in (select public.my_location_ids()))
      and (ra.profile_id is null or ra.profile_id = auth.uid())
  );
$$;

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.resources            enable row level security;
alter table public.resource_assignments enable row level security;
alter table public.resource_signoffs    enable row level security;

-- resources: super admin manages; anyone reads what's assigned to them.
create policy "resources: read if assigned" on public.resources
  for select using (public.is_super_admin() or public.can_view_resource(id));
create policy "resources: super admin insert" on public.resources
  for insert with check (public.is_super_admin());
create policy "resources: super admin update" on public.resources
  for update using (public.is_super_admin());
create policy "resources: super admin delete" on public.resources
  for delete using (public.is_super_admin());

-- assignments: super admin manages; managers may read those in their scope.
create policy "assignments: read in scope" on public.resource_assignments
  for select using (
    public.is_super_admin()
    or location_id is null
    or location_id in (select public.my_location_ids())
    or profile_id = auth.uid()
  );
create policy "assignments: super admin write" on public.resource_assignments
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- sign-offs: an employee records their own; managers/admins read in scope.
create policy "signoffs: read in scope" on public.resource_signoffs
  for select using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "signoffs: employee signs own" on public.resource_signoffs
  for insert with check (profile_id = auth.uid());
