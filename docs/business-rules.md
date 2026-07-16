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

## 9. Employee reviews 📝
- Managers **request a review every 6 months** per employee.

## 10. Time off 📝
- A request includes a **description/reason** and needs **manager approval**.
- Must be submitted **≥ 2 weeks in advance**.
- If **< 2 weeks**: the employee's shift goes to the **“Up for grabs”** pool for
  **anyone (globally) to accept**, then the **manager approves** the claim.
- Managers can **block off days** (blackout) from being requested off.
- **Cap: max 2 approved days-off requests per day.**

## 11. Shift swaps 📝
- Employees can **swap shifts**; a **manager approves**.
- A swap is **flagged when it deviates a rule** (e.g. skill/coverage), so the
  manager sees the risk before approving.

## 12. Up for grabs 📝
- A global pool of open/dropped shifts anyone can **claim**; the **manager
  approves** the claim before it's final.

---

### Open questions (need your call to implement 7–12)
- **Reviews**: counted from each employee's **hire date** or on a fixed calendar?
  Does a review re-rate the 1–5 skills, add notes, or both?
- **2-per-day time-off cap**: per **location** (assumed) or company-wide?
- **Swap rule-deviation**: **flag + let the manager override** (assumed), or hard-block?
- **Blackout days**: set per location by its manager, for any date range?
