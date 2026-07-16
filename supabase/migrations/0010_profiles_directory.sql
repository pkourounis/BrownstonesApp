-- =============================================================================
-- 0010_profiles_directory.sql
-- Richer, globally-visible profiles (any employee can see any employee's basic
-- + social profile). Sensitive data (pay) is moved out; skill stays private.
-- Also adds invite / access / floor-clearance fields.
-- =============================================================================

alter table public.profiles
  add column if not exists instagram          text,
  add column if not exists tiktok             text,
  add column if not exists website            text,
  add column if not exists is_floor_cleared   boolean not null default false,
  add column if not exists must_change_password boolean not null default true,
  add column if not exists invited_at         timestamptz;

-- Move pay out of profiles so the directory can be world-readable without
-- exposing compensation.
create table if not exists public.profile_compensation (
  profile_id  uuid primary key references public.profiles(id) on delete cascade,
  hourly_rate numeric(8,2),
  updated_at  timestamptz not null default now()
);
insert into public.profile_compensation (profile_id, hourly_rate)
  select id, hourly_rate from public.profiles where hourly_rate is not null
  on conflict do nothing;
alter table public.profiles drop column if exists hourly_rate;

alter table public.profile_compensation enable row level security;
create policy "comp: self + managers read" on public.profile_compensation
  for select using (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "comp: managers write" on public.profile_compensation
  for all using (
    public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  ) with check (
    public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );

-- Public roles view: everyone can see WHICH roles a person works (for their
-- profile), WITHOUT the private skill rating. Runs with definer rights so it
-- bypasses staff_positions' manager-only RLS but only exposes non-sensitive cols.
create or replace view public.staff_public_roles as
  select profile_id, position_id, is_primary from public.staff_positions;
grant select on public.staff_public_roles to authenticated;

-- Broaden profile reads: any authenticated user can see basic/social profiles
-- (directory + global feed). Pay is gone; skill lives in staff_positions.
drop policy if exists "profiles: read self / same-location / admin" on public.profiles;
create policy "profiles: read all authenticated" on public.profiles
  for select using (auth.uid() is not null);
