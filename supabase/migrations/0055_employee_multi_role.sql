-- =============================================================================
-- 0055_employee_multi_role.sql
-- Employees can work multiple roles (e.g. server + host). role_title stays the
-- primary/default role; role_titles holds every role they can work.
-- =============================================================================

alter table public.employees add column if not exists role_titles text[] not null default '{}';

update public.employees
  set role_titles = array[role_title]
  where role_title is not null and role_title <> '' and (role_titles is null or role_titles = '{}');
