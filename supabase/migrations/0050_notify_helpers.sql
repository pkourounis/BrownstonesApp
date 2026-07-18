-- =============================================================================
-- 0050_notify_helpers.sql
-- In-app notification helpers powering the notification center.
--   * notify_users(): insert notifications for arbitrary users (never the
--     actor) — SECURITY DEFINER so any authenticated user can alert teammates
--     without needing the service-role key.
--   * location_managers(): managers + super admins for a location, used to
--     alert approvers when a request needs review.
-- =============================================================================

create or replace function public.notify_users(p_targets uuid[], p_type text, p_title text, p_body text, p_link text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.notifications (profile_id, type, title, body, link)
  select distinct t, p_type::public.notification_type, p_title, p_body, p_link
  from unnest(p_targets) as t
  where t is not null and t <> auth.uid();
end;
$$;

create or replace function public.location_managers(p_location uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles
  where role in ('manager', 'super_admin')
    and employment_status <> 'inactive'
    and (role = 'super_admin' or primary_location_id = p_location);
$$;
