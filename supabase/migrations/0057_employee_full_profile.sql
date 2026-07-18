-- =============================================================================
-- 0057_employee_full_profile.sql
-- Give every roster member the same "profile build" as app users. These fields
-- live on employees (roster members mostly have no auth account, so no profile
-- row); they're mirrored to the profile when the member is granted app access.
-- Ranking (employees.rating) stays manager-only and is not part of this set.
-- =============================================================================

alter table public.employees
  add column if not exists avatar_url               text,
  add column if not exists bio                      text,
  add column if not exists address                  text,
  add column if not exists birthday                 date,
  add column if not exists hired_at                 date,
  add column if not exists marital_status           text,
  add column if not exists facebook                 text,
  add column if not exists instagram                text,
  add column if not exists emergency_contact_name   text,
  add column if not exists emergency_contact_phone  text;
