-- =============================================================================
-- 0016_location_toast_guid.sql
-- Map each location to its Toast POS restaurant GUID so the sales sync can pull
-- hourly revenue per store into pos_sales. The GUID is an external identifier
-- (not a secret); the Toast client id/secret live in server-side secrets only.
-- =============================================================================

alter table public.locations
  add column if not exists toast_guid uuid unique;

comment on column public.locations.toast_guid is
  'Toast POS restaurant GUID (external id) used by the pos_sales sync.';
