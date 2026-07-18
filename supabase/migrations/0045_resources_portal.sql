-- =============================================================================
-- 0045_resources_portal.sql
-- Surface the existing resources system as an employee resource portal.
--   * resources gains `kind` (doc/video/link) + `category` for display.
--   * resource_assignments gains department + managers_only targeting so a
--     resource's audience can be everyone / managers-only / a store / a dept.
--   * can_view_resource() honors the new targeting (+ primary_location fallback
--     for app users provisioned from the roster without staff_locations rows).
--   * a public 'resources' storage bucket for uploaded docs/videos.
--   * relaxes the 'feed' bucket to accept video uploads.
-- =============================================================================

alter table public.resources
  add column if not exists kind     text not null default 'link',
  add column if not exists category text not null default 'General';

alter table public.resource_assignments
  add column if not exists department    public.department,
  add column if not exists managers_only boolean not null default false;

create or replace function public.can_view_resource(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.resource_assignments ra
    where ra.resource_id = rid
      and (ra.location_id is null
           or ra.location_id in (select public.my_location_ids())
           or ra.location_id = (select primary_location_id from public.profiles where id = auth.uid()))
      and (ra.profile_id is null or ra.profile_id = auth.uid())
      and (ra.department is null or ra.department = (select department from public.profiles where id = auth.uid()))
      and (not ra.managers_only or public.is_manager_or_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded docs/videos. Public read; super-admin write.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do nothing;

drop policy if exists "resources bucket read" on storage.objects;
create policy "resources bucket read" on storage.objects
  for select using (bucket_id = 'resources');

drop policy if exists "resources bucket admin write" on storage.objects;
create policy "resources bucket admin write" on storage.objects
  for insert with check (bucket_id = 'resources' and public.is_super_admin());

drop policy if exists "resources bucket admin update" on storage.objects;
create policy "resources bucket admin update" on storage.objects
  for update using (bucket_id = 'resources' and public.is_super_admin());

drop policy if exists "resources bucket admin delete" on storage.objects;
create policy "resources bucket admin delete" on storage.objects
  for delete using (bucket_id = 'resources' and public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Allow video (any type) in the feed bucket, up to 50 MB.
-- ---------------------------------------------------------------------------
update storage.buckets
  set allowed_mime_types = null, file_size_limit = 52428800
  where id = 'feed';
