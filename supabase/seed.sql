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

-- =============================================================================
-- Per-location staffing requirements (season = 'standard'). Generated from the
-- coverage rules for each restaurant. must_cover_open flags the 7am opener.
-- =============================================================================
insert into public.staffing_requirements (location_id, position_id, day_of_week, required_count, must_cover_open)
select l.id, p.id, v.dow, v.cnt, v.must_open
from (values
  ('amityville','Server',0,6,true),
  ('amityville','Server',1,5,true),
  ('amityville','Server',2,5,true),
  ('amityville','Server',3,5,true),
  ('amityville','Server',4,5,true),
  ('amityville','Server',5,5,true),
  ('amityville','Server',6,6,true),
  ('amityville','Busser',0,2,false),
  ('amityville','Busser',6,2,false),
  ('amityville','Barista',0,2,false),
  ('amityville','Barista',1,1,false),
  ('amityville','Barista',2,1,false),
  ('amityville','Barista',3,1,false),
  ('amityville','Barista',4,1,false),
  ('amityville','Barista',5,2,false),
  ('amityville','Barista',6,2,false),
  ('amityville','Host',0,2,false),
  ('amityville','Host',1,1,false),
  ('amityville','Host',2,1,false),
  ('amityville','Host',3,1,false),
  ('amityville','Host',4,1,false),
  ('amityville','Host',5,1,false),
  ('amityville','Host',6,2,false),
  ('amityville','Drink Runner',0,1,false),
  ('amityville','Drink Runner',6,1,false),
  ('amityville','Food Runner',0,2,false),
  ('amityville','Food Runner',1,1,false),
  ('amityville','Food Runner',2,1,false),
  ('amityville','Food Runner',3,1,false),
  ('amityville','Food Runner',4,1,false),
  ('amityville','Food Runner',5,1,false),
  ('amityville','Food Runner',6,2,false),
  ('amityville','Expo',0,1,false),
  ('amityville','Expo',5,1,false),
  ('amityville','Expo',6,1,false),
  ('amityville','Cook',0,5,false),
  ('amityville','Cook',1,4,false),
  ('amityville','Cook',2,4,false),
  ('amityville','Cook',3,4,false),
  ('amityville','Cook',4,4,false),
  ('amityville','Cook',5,4,false),
  ('amityville','Cook',6,5,false),
  ('amityville','Prep Cook',0,1,false),
  ('amityville','Prep Cook',1,1,false),
  ('amityville','Prep Cook',2,1,false),
  ('amityville','Prep Cook',3,1,false),
  ('amityville','Prep Cook',4,1,false),
  ('amityville','Prep Cook',5,1,false),
  ('amityville','Prep Cook',6,1,false),
  ('amityville','Dishwasher',0,2,false),
  ('amityville','Dishwasher',1,2,false),
  ('amityville','Dishwasher',2,2,false),
  ('amityville','Dishwasher',3,2,false),
  ('amityville','Dishwasher',4,2,false),
  ('amityville','Dishwasher',5,2,false),
  ('amityville','Dishwasher',6,2,false),
  ('west-islip','Server',0,6,true),
  ('west-islip','Server',1,5,true),
  ('west-islip','Server',2,5,true),
  ('west-islip','Server',3,5,true),
  ('west-islip','Server',4,5,true),
  ('west-islip','Server',5,5,true),
  ('west-islip','Server',6,6,true),
  ('west-islip','Busser',0,2,false),
  ('west-islip','Busser',6,2,false),
  ('west-islip','Barista',0,2,false),
  ('west-islip','Barista',1,1,false),
  ('west-islip','Barista',2,1,false),
  ('west-islip','Barista',3,1,false),
  ('west-islip','Barista',4,1,false),
  ('west-islip','Barista',5,2,false),
  ('west-islip','Barista',6,2,false),
  ('west-islip','Host',0,3,false),
  ('west-islip','Host',1,1,false),
  ('west-islip','Host',2,1,false),
  ('west-islip','Host',3,1,false),
  ('west-islip','Host',4,1,false),
  ('west-islip','Host',5,1,false),
  ('west-islip','Host',6,3,false),
  ('west-islip','Drink Runner',0,1,false),
  ('west-islip','Drink Runner',6,1,false),
  ('west-islip','Food Runner',0,2,false),
  ('west-islip','Food Runner',1,1,false),
  ('west-islip','Food Runner',2,1,false),
  ('west-islip','Food Runner',3,1,false),
  ('west-islip','Food Runner',4,1,false),
  ('west-islip','Food Runner',5,1,false),
  ('west-islip','Food Runner',6,2,false),
  ('west-islip','Expo',0,1,false),
  ('west-islip','Expo',5,1,false),
  ('west-islip','Expo',6,1,false),
  ('west-islip','Cook',0,5,false),
  ('west-islip','Cook',1,4,false),
  ('west-islip','Cook',2,4,false),
  ('west-islip','Cook',3,4,false),
  ('west-islip','Cook',4,4,false),
  ('west-islip','Cook',5,4,false),
  ('west-islip','Cook',6,5,false),
  ('west-islip','Prep Cook',0,1,false),
  ('west-islip','Prep Cook',1,1,false),
  ('west-islip','Prep Cook',2,1,false),
  ('west-islip','Prep Cook',3,1,false),
  ('west-islip','Prep Cook',4,1,false),
  ('west-islip','Prep Cook',5,1,false),
  ('west-islip','Prep Cook',6,1,false),
  ('west-islip','Dishwasher',0,2,false),
  ('west-islip','Dishwasher',1,2,false),
  ('west-islip','Dishwasher',2,2,false),
  ('west-islip','Dishwasher',3,2,false),
  ('west-islip','Dishwasher',4,2,false),
  ('west-islip','Dishwasher',5,2,false),
  ('west-islip','Dishwasher',6,2,false),
  ('east-northport','Server',0,4,true),
  ('east-northport','Server',1,3,true),
  ('east-northport','Server',2,3,true),
  ('east-northport','Server',3,3,true),
  ('east-northport','Server',4,3,true),
  ('east-northport','Server',5,3,true),
  ('east-northport','Server',6,4,true),
  ('east-northport','Busser',0,1,false),
  ('east-northport','Busser',6,1,false),
  ('east-northport','Barista',0,1,false),
  ('east-northport','Barista',1,1,false),
  ('east-northport','Barista',2,1,false),
  ('east-northport','Barista',3,1,false),
  ('east-northport','Barista',4,1,false),
  ('east-northport','Barista',5,1,false),
  ('east-northport','Barista',6,1,false),
  ('east-northport','Host',0,2,false),
  ('east-northport','Host',1,1,false),
  ('east-northport','Host',2,1,false),
  ('east-northport','Host',3,1,false),
  ('east-northport','Host',4,1,false),
  ('east-northport','Host',5,1,false),
  ('east-northport','Host',6,2,false),
  ('east-northport','Food Runner',0,1,false),
  ('east-northport','Food Runner',1,1,false),
  ('east-northport','Food Runner',2,1,false),
  ('east-northport','Food Runner',3,1,false),
  ('east-northport','Food Runner',4,1,false),
  ('east-northport','Food Runner',5,1,false),
  ('east-northport','Food Runner',6,1,false),
  ('east-northport','Expo',0,1,false),
  ('east-northport','Expo',5,1,false),
  ('east-northport','Expo',6,1,false),
  ('east-northport','Cook',0,4,false),
  ('east-northport','Cook',1,4,false),
  ('east-northport','Cook',2,4,false),
  ('east-northport','Cook',3,4,false),
  ('east-northport','Cook',4,4,false),
  ('east-northport','Cook',5,4,false),
  ('east-northport','Cook',6,4,false),
  ('east-northport','Dishwasher',0,2,false),
  ('east-northport','Dishwasher',1,2,false),
  ('east-northport','Dishwasher',2,2,false),
  ('east-northport','Dishwasher',3,2,false),
  ('east-northport','Dishwasher',4,2,false),
  ('east-northport','Dishwasher',5,2,false),
  ('east-northport','Dishwasher',6,2,false),
  ('centereach','Server',0,5,true),
  ('centereach','Server',1,4,true),
  ('centereach','Server',2,4,true),
  ('centereach','Server',3,4,true),
  ('centereach','Server',4,4,true),
  ('centereach','Server',5,4,true),
  ('centereach','Server',6,5,true),
  ('centereach','Busser',0,2,false),
  ('centereach','Busser',6,1,false),
  ('centereach','Barista',0,1,false),
  ('centereach','Barista',5,1,false),
  ('centereach','Barista',6,1,false),
  ('centereach','Host',0,2,false),
  ('centereach','Host',1,1,false),
  ('centereach','Host',2,1,false),
  ('centereach','Host',3,1,false),
  ('centereach','Host',4,1,false),
  ('centereach','Host',5,2,false),
  ('centereach','Host',6,2,false),
  ('centereach','Food Runner',0,1,false),
  ('centereach','Food Runner',1,1,false),
  ('centereach','Food Runner',2,1,false),
  ('centereach','Food Runner',3,1,false),
  ('centereach','Food Runner',4,1,false),
  ('centereach','Food Runner',5,1,false),
  ('centereach','Food Runner',6,1,false),
  ('centereach','Expo',0,1,false),
  ('centereach','Expo',6,1,false),
  ('centereach','Cook',0,5,false),
  ('centereach','Cook',1,4,false),
  ('centereach','Cook',2,4,false),
  ('centereach','Cook',3,4,false),
  ('centereach','Cook',4,4,false),
  ('centereach','Cook',5,4,false),
  ('centereach','Cook',6,5,false),
  ('centereach','Prep Cook',0,1,false),
  ('centereach','Prep Cook',1,1,false),
  ('centereach','Prep Cook',2,1,false),
  ('centereach','Prep Cook',3,1,false),
  ('centereach','Prep Cook',4,1,false),
  ('centereach','Prep Cook',5,1,false),
  ('centereach','Prep Cook',6,1,false),
  ('centereach','Dishwasher',0,2,false),
  ('centereach','Dishwasher',1,2,false),
  ('centereach','Dishwasher',2,2,false),
  ('centereach','Dishwasher',3,2,false),
  ('centereach','Dishwasher',4,2,false),
  ('centereach','Dishwasher',5,2,false),
  ('centereach','Dishwasher',6,2,false),
  ('sayville','Server',0,5,true),
  ('sayville','Server',1,4,true),
  ('sayville','Server',2,4,true),
  ('sayville','Server',3,4,true),
  ('sayville','Server',4,4,true),
  ('sayville','Server',5,4,true),
  ('sayville','Server',6,5,true),
  ('sayville','Busser',0,2,false),
  ('sayville','Busser',6,1,false),
  ('sayville','Barista',0,1,false),
  ('sayville','Barista',5,1,false),
  ('sayville','Barista',6,1,false),
  ('sayville','Host',0,2,false),
  ('sayville','Host',1,1,false),
  ('sayville','Host',2,1,false),
  ('sayville','Host',3,1,false),
  ('sayville','Host',4,1,false),
  ('sayville','Host',5,2,false),
  ('sayville','Host',6,2,false),
  ('sayville','Food Runner',0,1,false),
  ('sayville','Food Runner',1,1,false),
  ('sayville','Food Runner',2,1,false),
  ('sayville','Food Runner',3,1,false),
  ('sayville','Food Runner',4,1,false),
  ('sayville','Food Runner',5,1,false),
  ('sayville','Food Runner',6,1,false),
  ('sayville','Expo',0,1,false),
  ('sayville','Expo',6,1,false),
  ('sayville','Cook',0,5,false),
  ('sayville','Cook',1,4,false),
  ('sayville','Cook',2,4,false),
  ('sayville','Cook',3,4,false),
  ('sayville','Cook',4,4,false),
  ('sayville','Cook',5,4,false),
  ('sayville','Cook',6,5,false),
  ('sayville','Prep Cook',0,1,false),
  ('sayville','Prep Cook',1,1,false),
  ('sayville','Prep Cook',2,1,false),
  ('sayville','Prep Cook',3,1,false),
  ('sayville','Prep Cook',4,1,false),
  ('sayville','Prep Cook',5,1,false),
  ('sayville','Prep Cook',6,1,false),
  ('sayville','Dishwasher',0,2,false),
  ('sayville','Dishwasher',1,2,false),
  ('sayville','Dishwasher',2,2,false),
  ('sayville','Dishwasher',3,2,false),
  ('sayville','Dishwasher',4,2,false),
  ('sayville','Dishwasher',5,2,false),
  ('sayville','Dishwasher',6,2,false)
) as v(slug, pos, dow, cnt, must_open)
join public.locations l on l.slug = v.slug
join public.positions p on p.name = v.pos
on conflict do nothing;

-- Per-location management rules (manager days off; lead-server-when-manager-off).
insert into public.scheduling_rules (location_id, department, rule_type, config, is_hard, description)
select l.id, 'management', v.rtype::public.scheduling_rule_type, v.cfg::jsonb, true, v.descr
from (values
  ('amityville','manager_days_off','{"days":[2]}','Manager off Tuesdays (works 6 days)'),
  ('amityville','lead_when_manager_off','{"position":"Server","basis":"highest_skill"}','Highest-ranked Server floor-leads when the manager is off'),
  ('west-islip','manager_days_off','{"days":[2,3]}','Manager off Tuesdays & Wednesdays (works 5 days)'),
  ('west-islip','lead_when_manager_off','{"position":"Server","basis":"highest_skill"}','Highest-ranked Server floor-leads when the manager is off'),
  ('east-northport','floor_manager_no_manager','{"position":"Server","floor_days":[1],"work_days":[2,5,6,0]}','No manager: highest-ranked Server floor-manages Monday, works Tue/Fri/Sat/Sun as lead'),
  ('east-northport','lead_when_manager_off','{"position":"Server","basis":"highest_skill"}','Highest-ranked Server floor-leads (no manager at this location)'),
  ('centereach','manager_days_off','{"days":[2,3]}','Manager off Tuesdays & Wednesdays (works 5 days)'),
  ('centereach','lead_when_manager_off','{"position":"Server","basis":"highest_skill"}','Highest-ranked Server floor-leads when the manager is off'),
  ('sayville','manager_days_off','{"days":[2,3]}','Manager off Tuesdays & Wednesdays (works 5 days)'),
  ('sayville','lead_when_manager_off','{"position":"Server","basis":"highest_skill"}','Highest-ranked Server floor-leads when the manager is off')
) as v(slug, rtype, cfg, descr)
join public.locations l on l.slug = v.slug
where not exists (select 1 from public.scheduling_rules where location_id is not null);

-- ---------------------------------------------------------------------------
-- Default season calendar: every month = 'standard' (org-wide). Override
-- specific months (and add seasonal staffing_requirements rows) once the
-- season month-ranges are defined.
-- ---------------------------------------------------------------------------
insert into public.season_calendar (location_id, month, season)
select null, m, 'standard'
from generate_series(1, 12) as m
where not exists (select 1 from public.season_calendar where location_id is null);

-- ---------------------------------------------------------------------------
-- Workflow rules (org-wide): time-off advance notice, per-day cap, review cadence.
-- ---------------------------------------------------------------------------
insert into public.scheduling_rules (location_id, department, rule_type, config, is_hard, description)
select * from (values
  (null::uuid, null::public.department, 'time_off_advance_days'::public.scheduling_rule_type,
     '{"days": 14}'::jsonb, true,  'Time-off must be requested at least 2 weeks in advance'),
  (null, null, 'max_time_off_per_day',
     '{"count": 2, "scope": "location"}'::jsonb, true, 'At most 2 approved days off per day, per location'),
  (null, null, 'review_cadence_months',
     '{"months": 6, "from": "hire_date"}'::jsonb, false, 'Managers review each employee every 6 months from hire date')
) as r(location_id, department, rule_type, config, is_hard, description)
where not exists (select 1 from public.scheduling_rules where rule_type = 'time_off_advance_days');
