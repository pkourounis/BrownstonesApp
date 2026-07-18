-- =============================================================================
-- 0059_chat_images.sql
-- Photo attachments in chat: an image_url on chat_messages and a public 'chat'
-- storage bucket any signed-in user can upload to.
-- =============================================================================

alter table public.chat_messages add column if not exists image_url text;

insert into storage.buckets (id, name, public) values ('chat', 'chat', true) on conflict (id) do nothing;

drop policy if exists "chat bucket read" on storage.objects;
create policy "chat bucket read" on storage.objects for select using (bucket_id = 'chat');

drop policy if exists "chat bucket insert" on storage.objects;
create policy "chat bucket insert" on storage.objects for insert with check (bucket_id = 'chat' and auth.uid() is not null);
