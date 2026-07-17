# Business Intelligence & Reporting — blueprint

BI for **Super Admin** and **Manager** users, powered by Toast sales + the app's
own schedule/pay data. The thesis: connect **sales → labor → profit** — the link
Toast can't show and this app can. Verified: live Toast pulls work (auth, all 5
restaurant GUIDs, hourly sales, order/menu detail). See `integrations/toast.md`.

## Key indicators (always-visible tiles)
Scoped to Today / WTD / MTD, each with a vs-last-period comp.

- **Net sales** (+ comp %) — headline
- **Labor % of sales** — flagged over the 25% target *(needs schedule + pay)*
- **Sales per labor hour (SPLH)** — efficiency *(needs labor)*
- **Average check** & **check/cover count**
- **Peak hour** + intensity
- **Voids / comps / discounts %** — waste + integrity
- **Cash vs card** mix

## Reports (the library)
- **Sales by hour / daypart** — breakfast vs lunch (peak detection; e.g. Sayville
  peaks 1 PM vs 11 AM elsewhere)
- **Sales by day of week** — coverage gaps
- **Trends** — WoW, MoM, and eventually YoY same-store sales
- **Store leaderboard** (Super Admin) — sales, labor %, SPLH, avg check
- **Menu / product mix** — top & bottom sellers, category ratio, attach rates;
  ties to the "new item announcement" resource (track how a launch actually sells)
- **Server performance** — sales per server, avg check by server (upselling)
- **Staffing variance** — scheduled headcount vs actual demand, in dollars

## Proactive insights & digests (uses existing push/notification plumbing)
- **Daily flash** at close, per store: sales, labor %, on/off target
- **Weekly Monday digest**: winners, laggards, overages, one recommendation each
- **Smart alerts**: growing peak, labor overage, attach-rate drop, sales anomaly

## Role scoping
- **Super Admin** — portfolio: all 5 stores side-by-side, leaderboard, company
  roll-up, drill into any store.
- **Manager** — their store only, plus an (anonymized) **benchmark vs company
  average** ("you're #2 of 5 on labor efficiency").

## Data sources
| Metric family | Source | Status |
|---|---|---|
| Sales, checks, avg check, by-hour, daypart, menu mix, voids/comps, tender | Toast Orders API | ✅ live (daily sync → `pos_sales`) |
| Server performance | Toast Orders (server on check) | ✅ available |
| **Employee wages / jobs** | **Toast Labor API** (`/labor/v1/employees` — per-job `wageOverrides`; `/labor/v1/jobs`) | ✅ **verified accessible** |
| Labor %, SPLH, staffing variance | Toast wages **+** app `shifts` (scheduled hours) | ⏳ wages importable; needs scheduled hours |
| Trends / forecast / **year view** | historical `pos_sales` (12-mo backfilled) + `location_sales_forecast` | ✅ live (~$14M/yr; forecast view in migration 0020) |

### Wages — Toast has them
The Labor API exposes each employee with a **per-job hourly wage** (`wageOverrides`)
and the job catalog. So the "add employee" flow can **import roster + wages from
Toast** rather than hand-entering pay. What Toast does NOT hold is the **1–5 skill
rating** (manager-set, private) — that stays in the app. Recommended flow: import
from Toast → manager adds skill + can override pay → `profiles` +
`profile_compensation` + `staff_positions`.

## Year view (12-month)
Backed by the 12-month `pos_sales` backfill:
- **Monthly sales bars** across the year + **YoY** comparison once a second year exists.
- **Seasonality curve** — which months run hot/cold per store. This feeds the
  **month-based staffing overrides** (`staffing_requirements.month`) directly:
  the year view tells you *which* months need more Servers / a Drink Runner, which
  is exactly the seasonal input the scheduler was designed to take.
- **Day-of-week × month heatmap** — demand patterns at a glance.
- Range control on Insights becomes **Today / Week / Month / Year**.

## Build order
1. **Phase 1 — now (Toast only):** sales KPIs, by-hour/day, daypart, store
   leaderboard, menu mix. *(Mocked: Insights tab.)*
2. **Phase 2 — labor:** labor %, SPLH, staffing variance, daily/weekly digests.
   Requires the Toast **sync** writing `pos_sales`, plus staff & pay data.
3. **Phase 3 — forecasting:** demand forecast per store/hour that feeds the AI
   scheduler; anomaly alerts. The flywheel: forecast → staff to it → labor % drops
   → BI proves it.

## Prereqs it rides on
- **The scheduled Toast sync** (edge function → `pos_sales`) — Phase 2+ history.
- **Employees + pay rates** entered (`profiles`, `profile_compensation`) and
  **published schedules** (`shifts`) — for any labor metric.
