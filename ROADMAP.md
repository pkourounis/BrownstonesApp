# Brownstones Coffee — Product Roadmap & Status

> **Living document.** Update this every session as features move between states.
> It is the shared source of truth so work doesn't drift from the plan.

**Last updated:** 2026-07-18

**Legend:** ✅ Done · 🟡 Partial · 🗄️ Database ready, no UI · ⬜ Not started

---

## The vision, in two halves

The app has two halves. Recent work has gone deep on the **Operations & Analytics**
half; the **Team & Social** half is largely still to build.

---

## Foundation
| Feature | Status | Notes |
|---|---|---|
| Auth (password + magic link) | ✅ | |
| Roles & permissions (super_admin / manager / employee) | ✅ | Enforced via RLS on every table + role-gated nav + manager location-scoping. Role editing on `/team/[id]` (super-admin). |
| Responsive shell (collapsible sidebar + mobile hamburger) | ✅ | |
| Multi-location (5 stores) | ✅ | |
| PWA (installable + web push plumbing) | 🟡 | Installable; push SW present; no in-app notification surface yet. |
| Deploy pipeline (GitHub Actions → Netlify on `main`) | ✅ | |

## Toast integration (data backbone)
| Feature | Status | Notes |
|---|---|---|
| OAuth + hourly sync + on-demand "Sync now" | ✅ | |
| Sales (`pos_sales`) + 12-month backfill | ✅ | |
| Menu / item sales (`pos_item_sales`) | ✅ | 35-day backfill |
| Labor: employees, jobs, punches (`toast_time_entries`) | ✅ | 90-day backfill |
| Published schedule from Sling (`toast_shifts`) | ✅ | |
| Sales forecast | ✅ | |

## Operations & Analytics
| Feature | Status | Notes |
|---|---|---|
| Insights dashboard (filters, KPIs, trends, leaderboard, dayparts) | ✅ | |
| Top sellers | ✅ | |
| Labor % + sales/labor-hour + labor section | ✅ | |
| Timesheets (punch in/out records) | ✅ | |
| Staffing recommendations (sales/hr → headcount) | ✅ | |
| Roster (Toast import + add in-app) | ✅ | |
| Shift builder (create + publish the week) | ✅ | |
| Scheduled vs actual | ✅ | |

## Team & People
| Feature | Status | Notes |
|---|---|---|
| Team directory | ✅ | |
| Member management (edit, archive, star ranking, reset password) | ✅ | `/team/[id]` |
| Profile (full form + avatar upload) | ✅ | |
| Self-service password change | ✅ | |
| Availability — employee sets it | 🟡 | Submits as pending; **manager approval screen ⬜** |
| Star ratings feed the scheduler | ⬜ | Ratings stored; scheduler weighting not wired yet |

## Team & Social — **the parked half**
| Feature | Status | Notes |
|---|---|---|
| Shift swapping | 🗄️ → ⬜ | `shift_swap_requests` table exists; no UI |
| Time-off requests | 🗄️ → ⬜ | `time_off_requests` table exists; no UI |
| Manager approvals hub (availability + time-off + swaps) | ⬜ | Central queue for everything needing a manager's yes/no |
| Chat (team / store messaging) | ⬜ | No table, no UI |
| Feed / announcements | ⬜ | No table, no UI |
| In-app notifications | 🟡 → ⬜ | `notifications` table + push plumbing exist; no in-app UI |

## Training & Resources (from schema, unbuilt UI)
| Feature | Status | Notes |
|---|---|---|
| Quizzes / training completions | 🗄️ → ⬜ | Tables exist |
| Resources / attachments / sign-offs | 🗄️ → ⬜ | Tables exist |

---

## Known follow-ups / tech debt
- Enforce `must_change_password` as a hard gate at login (flag is set on reset, not enforced).
- Rotate the Toast client secret; enable Supabase leaked-password protection.
- Labor cost is a *floor* — salaried staff report $0 hourly in Toast (labeled in UI).
- Backfills (labor 90d, menu 35d) still filling historically in the background.

## Proposed build order for the parked half
1. **Manager approvals hub** — start with availability (employee side already ships), then extend to time-off and swaps.
2. **Time-off requests** — UI on the existing table.
3. **Shift swapping** — UI on the existing table.
4. **Feed / announcements** — needs a table + UI.
5. **Chat** — needs tables + UI.
6. **In-app notifications** — surface the `notifications` table; tie into push.
