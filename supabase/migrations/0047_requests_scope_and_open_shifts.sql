-- =============================================================================
-- 0047_requests_scope_and_open_shifts.sql
-- Powers the approvals hub + shift "up for grabs":
--   * my_location_ids() now includes the user's primary_location_id, so app
--     users provisioned from the roster (no staff_locations row) can see their
--     store's schedule, teammates, resources, and open shifts.
--   * RLS so teammates at the same store can SEE and CLAIM an unclaimed open
--     drop (shift_swap_requests with requested_to null).
-- =============================================================================

create or replace function public.my_location_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select location_id from public.staff_locations where profile_id = auth.uid()
  union
  select primary_location_id from public.profiles where id = auth.uid() and primary_location_id is not null;
$$;

drop policy if exists "swaps: peers see open drops" on public.shift_swap_requests;
create policy "swaps: peers see open drops" on public.shift_swap_requests
  for select using (
    requested_to is null
    and status = 'pending'
    and exists (
      select 1 from public.shifts s
      where s.id = shift_id and s.location_id in (select public.my_location_ids())
    )
  );

drop policy if exists "swaps: peers claim open drops" on public.shift_swap_requests;
create policy "swaps: peers claim open drops" on public.shift_swap_requests
  for update using (
    requested_to is null
    and status = 'pending'
    and requested_by <> auth.uid()
    and exists (
      select 1 from public.shifts s
      where s.id = shift_id and s.location_id in (select public.my_location_ids())
    )
  ) with check (requested_to = auth.uid());
