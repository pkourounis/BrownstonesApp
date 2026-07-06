-- =============================================================================
-- 0003_notifications.sql
-- Web-push subscriptions and in-app notifications.
-- When a schedule is published, employees receive a push + an in-app notice.
-- =============================================================================

create type public.notification_type as enum (
  'schedule_published',
  'shift_changed',
  'time_off_reviewed',
  'swap_request',
  'announcement',
  'general'
);

-- Browser Web-Push subscriptions (one per device/browser per user).
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_profile_idx on public.push_subscriptions(profile_id);

-- In-app notification feed.
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  type        public.notification_type not null default 'general',
  title       text not null,
  body        text,
  link        text,             -- in-app route to open on tap
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notifications_profile_idx on public.notifications(profile_id, created_at desc);

-- ===========================================================================
-- Row-Level Security — users only touch their own rows; managers/admins may
-- create notifications for staff in scope (e.g. when publishing a schedule).
-- ===========================================================================
alter table public.push_subscriptions enable row level security;
alter table public.notifications      enable row level security;

create policy "push: owner manages own" on public.push_subscriptions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "notifications: owner reads" on public.notifications
  for select using (profile_id = auth.uid() or public.is_super_admin());
create policy "notifications: owner updates (read state)" on public.notifications
  for update using (profile_id = auth.uid());
create policy "notifications: managers create in scope" on public.notifications
  for insert with check (
    profile_id = auth.uid()
    or public.is_super_admin()
    or (public.is_manager_or_admin() and public.shares_location(profile_id))
  );
create policy "notifications: owner or admin deletes" on public.notifications
  for delete using (profile_id = auth.uid() or public.is_super_admin());
