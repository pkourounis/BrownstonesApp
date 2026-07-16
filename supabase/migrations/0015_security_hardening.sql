-- =============================================================================
-- 0015_security_hardening.sql
-- Addresses Supabase security-advisor findings without changing intended
-- behaviour.
--
-- 1) Toast demand views run with SECURITY INVOKER so they inherit pos_sales'
--    row-level security. Previously they were SECURITY DEFINER + granted to
--    `authenticated`, which let ANY signed-in user (including employees) read
--    every location's hourly revenue. With invoker rights they respect the
--    pos_sales policy: super admin -> all, manager -> own locations, employee
--    -> none.
-- 2) Pin search_path on the touch_updated_at trigger function.
-- 3) Remove the trigger-only functions from the PostgREST RPC surface. These
--    are never called directly (triggers fire regardless of EXECUTE grants),
--    so revoking EXECUTE is safe and shrinks the attack surface.
--
-- NOT changed (intentional SECURITY DEFINER, documented in their own
-- migrations): staff_public_roles and quiz_questions_public deliberately bypass
-- manager-only RLS to expose curated, non-sensitive columns (roles without the
-- private skill rating; quiz prompts without the answer key). The RLS helper
-- functions (is_super_admin, is_manager_or_admin, my_location_ids, ...) stay
-- executable because RLS policies invoke them; via RPC they only reveal facts
-- about the caller's own access.
-- =============================================================================

alter view public.location_hour_demand        set (security_invoker = on);
alter view public.location_peak_hours_derived  set (security_invoker = on);

alter function public.touch_updated_at() set search_path = '';

revoke execute on function public.touch_updated_at()  from public, anon, authenticated;
revoke execute on function public.handle_new_user()   from public, anon, authenticated;
revoke execute on function public.guard_role_change() from public, anon, authenticated;
