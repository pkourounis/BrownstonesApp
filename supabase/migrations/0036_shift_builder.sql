-- =============================================================================
-- 0036_shift_builder.sql
-- Let shifts be assigned from the unified roster (Toast-imported or manual),
-- not just app-login profiles, and add a helper to create a shift with proper
-- America/New_York time handling.
-- =============================================================================

alter table public.shifts
  add column if not exists roster_employee_id uuid references public.employees(id) on delete set null;

create index if not exists shifts_roster_emp_idx on public.shifts(roster_employee_id);

-- ---------------------------------------------------------------------------
-- Create a draft shift. Times are wall-clock ET ('HH:MM'); an end at or before
-- the start rolls to the next day (overnight). SECURITY INVOKER so the existing
-- "manager insert" RLS policy (manages_location) governs who can schedule.
-- ---------------------------------------------------------------------------
create or replace function public.create_shift(
  p_location uuid,
  p_date date,
  p_start text,
  p_end text,
  p_break integer default 0,
  p_employee uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_id uuid; v_starts timestamptz; v_ends timestamptz;
begin
  v_starts := ((p_date::text || ' ' || p_start)::timestamp at time zone 'America/New_York');
  v_ends   := ((p_date::text || ' ' || p_end)::timestamp   at time zone 'America/New_York');
  if v_ends <= v_starts then v_ends := v_ends + interval '1 day'; end if;

  insert into public.shifts (location_id, roster_employee_id, starts_at, ends_at, break_minutes, status, created_by)
  values (p_location, p_employee, v_starts, v_ends, greatest(coalesce(p_break, 0), 0), 'draft', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
