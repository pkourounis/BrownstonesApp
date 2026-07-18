-- =============================================================================
-- 0039_profile_fields.sql
-- Expand profiles for a complete profile form, and add an avatars storage
-- bucket so employees can upload a profile photo.
-- =============================================================================

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists facebook text,
  add column if not exists address text,
  add column if not exists marital_status text
    check (marital_status is null or marital_status in ('single','married','other')),
  add column if not exists department public.department,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

-- Seed first/last name from any existing full_name so the form isn't blank.
update public.profiles
set first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
    last_name  = coalesce(last_name, nullif(regexp_replace(full_name, '^\S+\s*', ''), ''))
where full_name is not null and (first_name is null or last_name is null);

-- ---------------------------------------------------------------------------
-- Avatars bucket: public read, each user manages only their own folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
