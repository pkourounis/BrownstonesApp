-- =============================================================================
-- 0013_resource_attachments.sql
-- Attachments (photos / documents) on a published resource/post. The post's
-- body is resources.description; a single primary link is resources.url; this
-- adds any number of file attachments.
-- =============================================================================

create table public.resource_attachments (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  url         text not null,
  kind        text not null default 'document',  -- 'photo' | 'document' | 'other'
  name        text,
  created_at  timestamptz not null default now()
);
create index resource_attachments_resource_idx on public.resource_attachments(resource_id);

alter table public.resource_attachments enable row level security;
-- Visible to anyone who can see the parent resource; super admin manages.
create policy "attachments: read if resource visible" on public.resource_attachments
  for select using (
    public.is_super_admin() or public.can_view_resource(resource_id)
  );
create policy "attachments: admin write" on public.resource_attachments
  for all using (public.is_super_admin()) with check (public.is_super_admin());
