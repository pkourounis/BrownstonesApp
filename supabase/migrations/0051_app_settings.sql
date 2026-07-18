-- =============================================================================
-- 0051_app_settings.sql
-- Singleton app settings: logo, splash/login image, primary accent color, and
-- operational defaults (labor target SPLH, weekly hour cap, shift length) used
-- by the scheduler. Readable by any signed-in user; only super admins write.
-- =============================================================================

create table if not exists public.app_settings (
  id                boolean primary key default true,
  logo_url          text,
  splash_url        text,
  primary_color     text,
  labor_target_splh numeric(10,2) not null default 75,
  weekly_hour_cap   integer not null default 40,
  shift_length      integer not null default 6,
  updated_by        uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings: read all" on public.app_settings;
create policy "app_settings: read all" on public.app_settings
  for select using (auth.uid() is not null);

drop policy if exists "app_settings: super admin write" on public.app_settings;
create policy "app_settings: super admin write" on public.app_settings
  for all using (public.is_super_admin()) with check (public.is_super_admin());
