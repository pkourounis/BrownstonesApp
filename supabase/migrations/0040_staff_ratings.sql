-- =============================================================================
-- 0040_staff_ratings.sql
-- Manager-only star ranking for team members (0–5). Kept out of profiles so the
-- rating isn't readable by the rated employee — only managers/admins in scope.
-- =============================================================================

create table if not exists public.staff_ratings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  rating     smallint not null check (rating between 0 and 5),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.staff_ratings enable row level security;

drop policy if exists "ratings: managers read in scope" on public.staff_ratings;
create policy "ratings: managers read in scope" on public.staff_ratings
  for select using (
    public.is_super_admin() or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );

drop policy if exists "ratings: managers write in scope" on public.staff_ratings;
create policy "ratings: managers write in scope" on public.staff_ratings
  for all using (
    public.is_super_admin() or (public.is_manager_or_admin() and public.shares_location(profile_id))
  ) with check (
    public.is_super_admin() or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
