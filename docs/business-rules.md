# Brownstones Coffee — Business Rules (master list)

The single source of truth for how the app should behave. Each rule is tagged
**✅ modeled** (encoded in `supabase/migrations` + types) or **📝 captured**
(documented, implementation pending). See `employees-and-scheduling.md` for the
staffing detail.

## 1. Departments & roles ✅
- **BOH**: Cook, Prep Cook, Dishwasher
- **FOH**: Server, Barista, Host, Busser, Drink Runner, Food Runner, Expo
- **Management**: Manager
- A role belongs to one department; an employee may hold roles across departments.

## 2. Permissions ✅
- **Super Admin** — everything, all locations.
- **Manager** — their location(s) and staff only.
- **Employee** — self, own schedule, teammates for feed/schedule.

## 3. Skill ranking ✅
- Set **1–5** (5 = most experienced) **per role** when a manager/super admin
  adds or updates an employee.
- **Private to managers/super admins** — never shown to the employee.

## 4. AI scheduler — inputs ✅
1. **Manager-approved availability** (only approved windows are bookable).
2. **Employee ranking** (skill 1–5) — strong staff on busy shifts.
3. **Location peak hours** (intensity per window).
4. **Hardcoded rules** (below), hard constraints + soft preferences.

## 5. Per-location staffing ✅
Exact per-day headcount per role for Amityville, West Islip, East Northport,
Centereach, Sayville (see `employees-and-scheduling.md`). Includes the **7am
Server opener** every day, and management rules:
- Amityville manager off **Tue**; West Islip / Centereach / Sayville off **Tue+Wed**.
- East Northport has **no manager** — highest-ranked Server floor-manages Monday,
  works Tue/Fri/Sat/Sun as lead.
- **Highest-ranked Server must be scheduled whenever the manager is off** (all).

## 6. Seasonality ✅ (calendar) / 📝 (numbers pending)
- Coverage throttles by **specific months** → each month maps to a season.
- Seasonal changes affect **only**: number of **Servers**, and whether a
  **Drink Runner** / **Food Runner** is needed.
- *Pending from you:* which months = which season, and the seasonal numbers.

## 7. Team Feed 📝
- **Global across all locations.** Anyone can **post, like, and comment.**

## 8. Chat 📝
- **Siloed per location.** All employees/members of a location share it,
  **including super admins** (who can open any location's chat).
- Department channels (Kitchen/BOH, FOH) live inside a location's chat.

## 9. Employee reviews ✅ (model) / 📝 (UI)
- A review is **due every 6 months from the employee's hire date**.
- The review **re-rates the 1–5 skills** and captures **notes** (`employee_reviews`
  with a `skills_snapshot`). Manager/super-admin visibility only.

## 10. Time off ✅ (model) / 📝 (enforcement UI)
- A request includes a **description/reason** and needs **manager approval**.
- Must be submitted **≥ 2 weeks in advance** (`time_off_advance_days = 14`).
- If **< 2 weeks**: the shift goes to the **“Up for grabs”** pool for **anyone,
  any location** to accept, then the **manager approves** (see §12).
- Managers can **block off days** — `time_off_blackouts` (per location).
- **Cap: max 2 approved days off per day, per location**
  (`max_time_off_per_day = { count: 2, scope: location }`).

## 11. Shift swaps ✅ (model) / 📝 (UI)
- Employees **swap shifts** (`shift_swap_requests.kind = 'swap'`); **manager approves**.
- **Flagged when it deviates a rule** (`deviates_rules` + `deviation_note`) so the
  manager sees the risk — **flag + override**, not a hard block.

## 12. Up for grabs ✅ (model) / 📝 (UI)
- Open/dropped shifts (`kind = 'pickup'`) are a **global** pool — **any employee at
  any location** can **claim** (`claimed_by`); the **manager approves**.

## 13. Super Admin — locations & publishing ✅ (model) / 📝 (UI)
- **Add a location** with full setup: address, phone, **location #**, **seats**,
  **tables**, **per-day business hours** (`location_hours`), **peak hours**,
  **assign a manager**, and **add staff**.
- **Only super admins publish** `resources`:
  - **product** — announcement of a new menu item (title, description, image)
  - **training**, **compliance** (sign-off), **link** (payroll, uniforms), **document**
- **Targeting** (`resource_assignments`): any/all **locations** and/or specific
  **employees**.
- **Compliance sign-off** (`resource_signoffs`) records **who acknowledged and
  when** — managers/admins can see who still hasn't signed.

---

### Decisions (confirmed)
- **Product offering**: an **announcement** (title + description/image), not a full menu item.
- **Business hours**: **open/close per day of week**.
- **Compliance sign-off**: **full audit trail** of who signed and when.
- **Reviews**: from **hire date**; re-rate skills **and** notes.
- **Time-off cap**: **per location** (2/day).
- **Swap conflicts**: **flag, manager can override**.
- **Up for grabs**: **any location can claim** (truly global).
