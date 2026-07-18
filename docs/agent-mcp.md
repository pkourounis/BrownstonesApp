# Brownstones Agent API (MCP)

A remote **MCP server** that lets an AI agent read and act on Brownstones data.
It is served by this Next.js app and reuses the app's own Row Level Security by
signing in as a dedicated super-admin service account — no Supabase service key
required.

## Endpoint

```
https://brownstones-coffee.netlify.app/api/mcp
```

- Transport: **Streamable HTTP** (the standard remote-MCP transport).
- Auth: every request must send `Authorization: Bearer <AGENT_API_TOKEN>`.

## Connecting an agent

For a Claude-based agent, add it as a remote MCP server (example config):

```json
{
  "mcpServers": {
    "brownstones": {
      "type": "http",
      "url": "https://brownstones-coffee.netlify.app/api/mcp",
      "headers": { "Authorization": "Bearer <AGENT_API_TOKEN>" }
    }
  }
}
```

Any MCP-capable client works the same way — point it at the URL and pass the
bearer token.

## Tools

### Read
| Tool | What it returns |
| --- | --- |
| `get_sales_summary` | Today (live), yesterday, YTD net sales, labor %, per-store net + daily-goal progress. No args. |
| `get_schedule` | A store's week of shifts + per-day scheduled vs. recommended hours. Args: `store`, optional `week` (any date in that week). |
| `get_staffing_rules` | A store's base headcount rules per role/day, notes, goals, targets. Args: `store`. |
| `list_employees` | Active roster: names, roles, store (no comp/PII). Args: optional `store`, `active`. |
| `list_requests` | Time-off / swap / availability / meeting requests. Args: optional `status` (pending·approved·denied·all), `types`. |

### Limited actions
| Tool | What it does |
| --- | --- |
| `post_announcement` | Publishes a feed announcement (attributed to the agent account). Args: `body`, optional `title`, `store`, `requires_ack`. |
| `set_daily_sales_goal` | Sets/clears a store's daily sales goal. Args: `store`, `amount` (or null to clear). |

`store` accepts a name, slug, or id (e.g. `"Amityville"`).

## Configuration (Netlify env vars)

| Var | Purpose |
| --- | --- |
| `AGENT_API_TOKEN` | Bearer token clients must send. Rotate here to revoke access. |
| `AGENT_USER_EMAIL` | Email of the agent super-admin service account. |
| `AGENT_USER_PASSWORD` | Password for that account. |

The agent account is a real (headless) super-admin, so everything it reads or
writes respects the same permissions and audit trail as a person — announcements
it posts show "Brownstones Agent" as the author.

## Security notes

- The token grants full super-admin-level access; only ever send it over HTTPS
  and store it as a secret.
- To revoke: change `AGENT_API_TOKEN` (blocks all callers) or disable the
  `agent@brownstones-coffee.app` account in Supabase (blocks data access).
- Approvals (approving/denying time-off, swaps) are intentionally **read-only**
  for the agent today; write access to those can be added later with guardrails.
