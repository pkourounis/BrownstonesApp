-- =============================================================================
-- 0053_meetings.sql
-- Meetings with roster employees (reviews, disciplinary, training, discussion,
-- other). Subject is a roster employee (not an app profile), so meetings can be
-- requested with anyone on the roster. Managers manage meetings for employees
-- at their location; super admins manage all.
-- =============================================================================

create type public.meeting_type as enum ('review', 'disciplinary', 'training', 'discussion', 'other');

create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  requested_by  uuid references public.profiles(id) on delete set null,
  type          public.meeting_type not null default 'review',
  scheduled_at  timestamptz,
  location      text,
  description   text,
  status        text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  rating        integer,
  notes         text,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists meetings_employee_idx on public.meetings(employee_id);
create index if not exists meetings_scheduled_idx on public.meetings(scheduled_at);

alter table public.meetings enable row level security;

drop policy if exists "meetings: manager rw" on public.meetings;
create policy "meetings: manager rw" on public.meetings
  for all using (
    public.is_super_admin()
    or exists (select 1 from public.employees e where e.id = meetings.employee_id and e.location_id in (select public.my_location_ids()))
  ) with check (
    public.is_super_admin()
    or exists (select 1 from public.employees e where e.id = meetings.employee_id and e.location_id in (select public.my_location_ids()))
  );
