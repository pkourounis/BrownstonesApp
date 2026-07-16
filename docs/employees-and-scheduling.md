# Employees, roles & AI scheduling rules

The business rules that drive staffing and the AI schedule optimizer. These are
enforced/encoded in `supabase/migrations/` and typed in `src/lib/database.types.ts`.

## Departments & job roles

Every job role (a "position") belongs to exactly **one department**. An employee
can hold roles across **multiple departments** (e.g. a Server who also preps).

| Department | Job roles |
|---|---|
| **BOH** — Back of House | Cook · Prep Cook · Dishwasher |
| **FOH** — Front of House | Server · Barista · Host · Busser · Drink Runner · Food Runner · Expo |
| **Management** | Manager |

Departments drive how the app groups people: chat silos (BOH / FOH / Management),
team lists, and schedule sections.

> Note: **department** (job function) is separate from **permission role**
> (`super_admin` / `manager` / `employee`). Someone in the Management department
> typically also has the `manager` permission role, but the two are set
> independently.

## Employee skill ranking (1–5)

When a **super admin or manager adds/updates an employee**, they must rank the
employee **1–5 for each job role** they can work (5 = most experienced). This is
stored per role assignment (`staff_positions.skill_level`).

- Skill ratings are a **management tool** and are **not visible to the employee**
  themselves (enforced by Row-Level Security). Employees see their roles
  indirectly through their scheduled shifts.
- The AI scheduler weights skill so stronger staff land on the busiest shifts.

## The AI scheduler's four parameters

The optimizer builds the schedule from:

1. **Manager-approved availability** — employees submit weekly availability
   windows; only windows a manager has **approved** (`availability.status =
   'approved'`) are treated as bookable.
2. **Employee ranking** — the 1–5 skill per role (`staff_positions.skill_level`).
3. **Location peak hours** — recurring busy windows per location with an
   intensity level (`location_peak_hours`); more, higher-skilled staff are
   placed during peaks.
4. **Hardcoded rules** — hard constraints and soft preferences
   (`scheduling_rules`), org-wide or per location/department. Seeded defaults:
   - Max 40 hours/week per employee *(hard)*
   - Min 10 hours rest between shifts — no close-then-open *(hard)*
   - Max 6 consecutive days worked *(hard)*
   - Staff under 18 not scheduled past 10pm *(hard)*
   - Keep labor at or under 25% of sales *(soft preference)*

Rules are flexible: `rule_type` + a JSON `config`, with `is_hard` marking a
must-satisfy constraint vs. a preference the optimizer tries to honor.

## Data model summary

| Table | Purpose |
|---|---|
| `positions` | Job roles, each with a `department` |
| `staff_positions` | Which roles an employee works + `skill_level` (1–5) |
| `availability` | Weekly windows + approval `status` |
| `location_peak_hours` | Busy windows per location + `intensity` |
| `scheduling_rules` | Hard/soft constraints (org-wide or scoped) |
| `shifts` | Scheduled/assigned shifts (a shift is for one position) |
