-- =============================================================================
-- 0001_foundation.sql
-- Core identity, locations, and the role-based permission model.
--
-- Permission tiers:
--   super_admin — sees and manages everything, all locations
--   manager     — sees and manages only the location(s) they are assigned to,
--                 and the staff at those location(s)
--   employee    — sees their own profile, their schedule, and teammates at
--                 the same location (for the team feed / schedule)
--
-- RBAC is enforced at the database layer via Row-Level Security (RLS) so that
-- the rules hold no matter which client calls the API.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('super_admin', 'manager', 'employee');
create type public.employment_status as enum ('onboarding', 'active', 'inactive');

-- ---------------------------------------------------------------------------
-- Locations (the 7 Brownstones restaurants, and more to come)
-- ---------------------------------------------------------------------------
create table public.locations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique,
  address      text,
  city         text,
  state        text default 'NY',
  postal_code  text,
  phone        text,
  timezone     text not null default 'America/New_York',
  is_active     boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles — one row per authenticated user, linked to Supabase Auth.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null default '',
  display_name        text,
  email               text,
  phone               text,
  avatar_url          text,
  role                public.app_role not null default 'employee',
  employment_status   public.employment_status not null default 'onboarding',
  primary_location_id uuid references public.locations(id) on delete set null,
  title               text,               -- e.g. "Shift Lead", "Head Chef"
  hourly_rate         numeric(8,2),        -- visible to managers/admins only (see policies)
  hired_at            date,
  birthday            date,
  bio                 text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Which locations a person is attached to. Employees: where they work.
-- Managers: the location(s) they manage. Enables multi-location staff.
create table public.staff_locations (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (profile_id, location_id)
);
create index staff_locations_location_idx on public.staff_locations(location_id);

-- Positions / job roles used for scheduling (Server, Barista, Cook, Host...).
create table public.positions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  color       text not null default '#a86f4e',   -- for schedule color-coding
  sort_order  integer not null default 0,
  is_active    boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helper functions.
-- These read the caller's role / locations while bypassing RLS, which avoids
-- the infinite-recursion trap of writing profile policies that query profiles.
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin', 'manager') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Location IDs the current user is attached to (works at / manages).
create or replace function public.my_location_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select location_id from public.staff_locations where profile_id = auth.uid();
$$;

-- Does the current user manage (or admin) the given location?
create or replace function public.manages_location(target_location uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.staff_locations sl
    join public.profiles p on p.id = sl.profile_id
    where sl.profile_id = auth.uid()
      and sl.location_id = target_location
      and p.role in ('super_admin', 'manager')
  );
$$;

-- Does the current user share any location with the target profile?
create or replace function public.shares_location(target_profile uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.staff_locations a
    join public.staff_locations b on a.location_id = b.location_id
    where a.profile_id = auth.uid()
      and b.profile_id = target_profile
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user is created.
-- Role defaults to 'employee'; an admin promotes as needed.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard: only a super_admin may change someone's role. Prevents privilege
-- escalation even if a manager can otherwise update a profile row.
-- ---------------------------------------------------------------------------
create or replace function public.guard_role_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only a super admin can change a user''s role.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_role_change
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- ---------------------------------------------------------------------------
-- keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_locations before update on public.locations
  for each row execute function public.touch_updated_at();
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.locations       enable row level security;
alter table public.profiles        enable row level security;
alter table public.staff_locations enable row level security;
alter table public.positions       enable row level security;

-- --- locations ---
create policy "locations: admin full read" on public.locations
  for select using (public.is_super_admin());
create policy "locations: members read own" on public.locations
  for select using (id in (select public.my_location_ids()));
create policy "locations: admin insert" on public.locations
  for insert with check (public.is_super_admin());
create policy "locations: admin update" on public.locations
  for update using (public.is_super_admin());
create policy "locations: admin delete" on public.locations
  for delete using (public.is_super_admin());

-- --- profiles ---
-- Read: yourself, super admin (all), or anyone sharing a location with you.
create policy "profiles: read self / same-location / admin" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_super_admin()
    or public.shares_location(id)
  );
-- Update your own profile.
create policy "profiles: update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- Managers can update staff at their location; super admin anyone.
create policy "profiles: manager update same-location" on public.profiles
  for update using (
    public.is_super_admin()
    or (public.current_role() = 'manager' and public.shares_location(id))
  );
-- Only super admin may hard-insert/delete profiles (normal flow is the signup
-- trigger; managers "invite" via the auth admin API which triggers it).
create policy "profiles: admin insert" on public.profiles
  for insert with check (public.is_super_admin() or id = auth.uid());
create policy "profiles: admin delete" on public.profiles
  for delete using (public.is_super_admin());

-- --- staff_locations ---
create policy "staff_locations: read in scope" on public.staff_locations
  for select using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or location_id in (select public.my_location_ids())
  );
create policy "staff_locations: manager write" on public.staff_locations
  for insert with check (public.manages_location(location_id));
create policy "staff_locations: manager update" on public.staff_locations
  for update using (public.manages_location(location_id));
create policy "staff_locations: manager delete" on public.staff_locations
  for delete using (public.manages_location(location_id));

-- --- positions --- (shared reference data)
create policy "positions: read all authenticated" on public.positions
  for select using (auth.uid() is not null);
create policy "positions: manager write" on public.positions
  for insert with check (public.is_manager_or_admin());
create policy "positions: manager update" on public.positions
  for update using (public.is_manager_or_admin());
create policy "positions: admin delete" on public.positions
  for delete using (public.is_super_admin());
