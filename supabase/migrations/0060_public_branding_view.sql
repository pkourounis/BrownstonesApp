-- =============================================================================
-- 0060_public_branding_view.sql
-- Branding (logo, splash, primary color) readable by unauthenticated visitors
-- for the login/splash screen — without exposing the scheduling numbers on
-- app_settings. security_invoker=false so the view bypasses app_settings RLS.
-- =============================================================================

create or replace view public.app_branding
with (security_invoker = false) as
  select logo_url, splash_url, primary_color from public.app_settings where id = true;

grant select on public.app_branding to anon, authenticated;
