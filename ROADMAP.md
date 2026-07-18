# Brownstones Coffee — Product Roadmap & Status

> **Living document.** Update this every session as features move between states.
> It is the shared source of truth so work doesn't drift from the plan.

**Last updated:** 2026-07-18 (added: Home redesign, schedule visibility scoping, push notifications, App Settings & Branding)

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
| Roster (Toast import + add in-app) | ✅ | Filters (name/location/role/department/status); full per-member edit, star rank, archive, delete |
| Admin: add / edit locations | ✅ | All fields: name, number, address, hours, seats/tables, revenue target, Toast GUID |
| Shift builder (create + publish the week) | ✅ | |
| Scheduled vs actual | ✅ | |
| Schedule visibility scoping | 🟡 → ⬜ | Managers see only their assigned location (RLS already scopes data); **super-admin needs an all-locations schedule view** (selector / combined) |

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
| Shift swapping + "up for grabs" | 🗄️ → ⬜ | Employees post a shift up for grabs; managers/super-admins approve swaps |
| Time-off requests | 🗄️ → ⬜ | `time_off_requests` table exists; no UI |
| Manager approvals hub (availability + time-off + swaps) | ⬜ | Managers/super-admins approve time-off, swaps, availability changes |
| FOH/BOH chat channels | ⬜ | Per-store front/back-of-house channels for managers |
| Chat (team / store messaging) | ✅ | Store channel + Managers channel + 1:1 DMs (no global chat) |
| Feed / announcements | ✅ | **Super-admin only**; title, photos, audience (all/store), category, likes, comments, share, **required acknowledgment** |
| **Push notifications** | 🟡 → ⬜ | Notifications are **push** (web-push service worker already present). Fire on schedule publish, approvals, swaps, etc. In-app notification center is secondary. |

## Training & Resources (from schema, unbuilt UI)
| Feature | Status | Notes |
|---|---|---|
| Employee reviews (request / complete) | 🗄️ → ⬜ | `employee_reviews` table exists; requestable from Home |
| Quizzes / training completions | 🗄️ → ⬜ | Tables exist |
| Resources / attachments / sign-offs | 🗄️ → ⬜ | Tables exist |

---

## Home / Dashboard — **v1 command center shipped 2026-07-18** 🟡
Role-aware daily command center is live: managers/admins get a sales hero (vs prior
day + sync freshness), by-store snapshot, needs-attention list, and quick actions;
employees get next shifts + availability status. Still to add: approvals tile,
announcements/feed preview, and per-alert push. Original candidate list:
| Idea | Notes |
|---|---|
| Today at a glance | Today's sales vs target, labor %, who's on now (from punches) |
| My next shift / today's schedule | Personalized per role |
| Action items | Pending approvals (manager), availability status, tasks |
| Alerts | Understaffed hours, no-shows, sync issues |
| Announcements / feed preview | Ties into the future Feed |
| Quick actions | Sync now, build schedule, add employee, etc. |
| Role-aware layout | Super-admin/manager see ops tiles; employees see their schedule + team |
| Request an employee review | ⬜ From Home, start a review with anyone on the roster (`employee_reviews` table exists) |
| Approve swaps / time-off inline | ⬜ Surface pending shift-swap & time-off requests on Home with approve/deny |

## App Settings & Branding — **new section (added 2026-07-18)**
An in-app settings area to customize the app without code. ⬜ Not started.
| Setting | Notes |
|---|---|
| Theme / colors | Adjust the brand palette in-app |
| Splash screen image | Replace the login/splash image |
| Logo upload | Replace the menu/sidebar logo |
| _More to come_ | User will expand this list |

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
