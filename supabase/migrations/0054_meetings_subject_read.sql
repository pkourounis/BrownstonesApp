-- =============================================================================
-- 0054_meetings_subject_read.sql
-- Let the employee a meeting is about read it (via their roster profile link),
-- so scheduled meetings can show on their Home Screen. Managers/super admins
-- keep full read/write via the existing policy.
-- =============================================================================

drop policy if exists "meetings: subject reads own" on public.meetings;
create policy "meetings: subject reads own" on public.meetings
  for select using (
    exists (select 1 from public.employees e where e.id = meetings.employee_id and e.profile_id = auth.uid())
  );
