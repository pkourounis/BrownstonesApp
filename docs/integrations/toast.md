# Toast POS integration

Goal: pull historical hourly sales from Toast and use them to (a) show revenue/hour
vs. labor, and (b) **compute peak hours automatically** instead of hardcoding them.

## Pipeline

```
Toast API ──sync──▶ pos_sales ──view──▶ location_hour_demand ──view──▶ location_peak_hours_derived ──▶ AI scheduler
 (hourly sales)    (raw history)      (8-wk avg by dow/hour)     (intensity 1/2/3, ranked per store)
```

- **`pos_sales`** — raw hourly revenue/transactions per location (`source='toast'`).
- **`location_hour_demand`** (view) — trailing **8-week** average revenue by
  (location, day-of-week, hour).
- **`location_peak_hours_derived`** (view) — each hour's **intensity** (1 light /
  2 standard / 3 peak), ranked against **that store's own** distribution
  (top third = peak). Verified: seeded Saturday sales → 9–11am = peak.
- The optimizer uses the **derived** intensity by default; a manager can still
  **pin/override** a window in `location_peak_hours` (auto + override).
- Below `locations.revenue_per_hour_target`, an hour is flagged to trim labor.

## The sync (to build server-side)

The only remaining piece is a server-side job (Supabase edge function on a
schedule, using the service-role key so RLS is bypassed for writes) that:
1. Authenticates to Toast (OAuth 2.0 client-credentials).
2. Pulls hourly sales per restaurant GUID.
3. Upserts into `pos_sales` (unique on location_id + business_date + hour).

### Reference MCP — security review

`github.com/BusyBee3333/toast-mcp-2026-complete` (community, ~8 stars).
- ✅ `package.json`: no pre/post-install scripts; standard deps (axios, express,
  zod, MCP SDK).
- ✅ `src/clients/toast.ts`: requests go **only** to official Toast hosts
  (`ws-api.toasttab.com`, `ws-sandbox-api.eng.toasttab.com`); credentials from
  config; tokens sent only to Toast; no `eval`/`child_process`/`fs`-write/telemetry;
  no credential logging.
- ⚠️ Low adoption / unknown maintenance; `repository` field points at a different
  repo (`mcpengine`); only the credential + HTTP path was audited (not all 50+
  tools / bundled React apps).

**Recommendation:** use it as a **reference** for the OAuth flow + endpoints and
write a **minimal purpose-built sync** for just hourly sales — smallest attack
surface, no unmaintained dependency in the credential path. If running the MCP
directly, start in **sandbox** with **least-privilege read-only** Toast
credentials.

## Prerequisite (from the business)

Toast API access is via Toast's partner/integration program: a **client id +
secret** and each restaurant's **GUID**. Chris/Brownstones obtains these from
Toast; they go in server-side secrets (never client-side).
