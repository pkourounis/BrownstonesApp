-- =============================================================================
-- seed.sql — reference data to get started. Safe to run once on a fresh DB.
-- Locations are placeholders; edit names/addresses in the app (Super Admin).
-- =============================================================================

insert into public.positions (name, color, sort_order) values
  ('Server',        '#a86f4e', 1),
  ('Barista',       '#8f5940', 2),
  ('Host',          '#bb8b6d', 3),
  ('Line Cook',     '#744736', 4),
  ('Prep Cook',     '#613c30', 5),
  ('Dishwasher',    '#53342b', 6),
  ('Cashier',       '#d1b199', 7),
  ('Shift Lead',    '#2c1a15', 8),
  ('Manager',       '#1f2937', 9)
on conflict (name) do nothing;

insert into public.locations (name, slug, city, state) values
  ('Brownstones — Location 1', 'location-1', 'Long Island', 'NY'),
  ('Brownstones — Location 2', 'location-2', 'Long Island', 'NY'),
  ('Brownstones — Location 3', 'location-3', 'Long Island', 'NY'),
  ('Brownstones — Location 4', 'location-4', 'Long Island', 'NY'),
  ('Brownstones — Location 5', 'location-5', 'Long Island', 'NY'),
  ('Brownstones — Location 6', 'location-6', 'Long Island', 'NY'),
  ('Brownstones — Location 7', 'location-7', 'Long Island', 'NY')
on conflict (slug) do nothing;
