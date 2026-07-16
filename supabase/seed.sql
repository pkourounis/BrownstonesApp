-- =============================================================================
-- seed.sql — reference data to get started. Safe to run once on a fresh DB.
-- Edit locations/roles in the app afterward (Super Admin).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Job roles, grouped by department. Colors are department-themed so the
-- schedule reads at a glance (FOH = gold/bronze, BOH = brick, Mgmt = deep).
-- ---------------------------------------------------------------------------
insert into public.positions (name, department, color, sort_order) values
  -- Front of House
  ('Server',       'foh',        '#7c5c28', 10),
  ('Barista',      'foh',        '#c69b4a', 11),
  ('Host',         'foh',        '#b48c3f', 12),
  ('Busser',       'foh',        '#d8b878', 13),
  ('Drink Runner', 'foh',        '#a87f30', 14),
  ('Food Runner',  'foh',        '#977030', 15),
  ('Expo',         'foh',        '#856325', 16),
  -- Back of House
  ('Cook',         'boh',        '#9c3f2c', 20),
  ('Prep Cook',    'boh',        '#b4503b', 21),
  ('Dishwasher',   'boh',        '#7e442c', 22),
  -- Management
  ('Manager',      'management', '#43331d', 30)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Locations (the confirmed Long Island restaurants; add the rest in-app).
-- ---------------------------------------------------------------------------
insert into public.locations (name, slug, address, city, state) values
  ('Amityville',     'amityville',     '55 Merrick Rd', 'Amityville',     'NY'),
  ('West Islip',     'west-islip',     null,            'West Islip',     'NY'),
  ('East Northport', 'east-northport', null,            'East Northport', 'NY'),
  ('Centereach',     'centereach',     null,            'Centereach',     'NY'),
  ('Sayville',       'sayville',       null,            'Sayville',       'NY')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- (4) Default hardcoded scheduling rules (org-wide). Adjust per location in-app.
-- ---------------------------------------------------------------------------
insert into public.scheduling_rules (location_id, department, rule_type, config, is_hard, description)
select * from (values
  (null::uuid, null::public.department, 'max_hours_per_week'::public.scheduling_rule_type,
     '{"hours": 40}'::jsonb, true,  'No employee scheduled over 40 hours/week'),
  (null, null, 'min_rest_hours_between_shifts',
     '{"hours": 10}'::jsonb, true,  'At least 10 hours between shifts (no close-then-open)'),
  (null, null, 'max_consecutive_days',
     '{"days": 6}'::jsonb,   true,  'No more than 6 consecutive days worked'),
  (null, null, 'minor_curfew',
     '{"under": 18, "no_later_than": "22:00"}'::jsonb, true, 'Staff under 18 cannot be scheduled past 10pm'),
  (null, null, 'max_labor_pct',
     '{"pct": 25}'::jsonb,   false, 'Aim to keep labor at or under 25% of sales')
) as r(location_id, department, rule_type, config, is_hard, description)
where not exists (select 1 from public.scheduling_rules);

-- ---------------------------------------------------------------------------
-- (3) Default peak hours for every location: weekend brunch rush (heavy) and
-- weekday mornings (standard). Managers refine these per location in-app.
-- ---------------------------------------------------------------------------
insert into public.location_peak_hours (location_id, day_of_week, start_time, end_time, intensity, note)
select l.id, d.dow, d.st::time, d.et::time, d.inten, d.lbl
from public.locations l
cross join (values
  (0, '08:00', '12:00', 3, 'Sunday brunch rush'),
  (6, '08:00', '12:00', 3, 'Saturday brunch rush'),
  (1, '07:00', '10:00', 2, 'Weekday morning'),
  (2, '07:00', '10:00', 2, 'Weekday morning'),
  (3, '07:00', '10:00', 2, 'Weekday morning'),
  (4, '07:00', '10:00', 2, 'Weekday morning'),
  (5, '07:00', '10:00', 2, 'Weekday morning')
) as d(dow, st, et, inten, lbl)
where not exists (select 1 from public.location_peak_hours);
