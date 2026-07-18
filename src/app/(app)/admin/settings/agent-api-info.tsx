'use client';

import { useState } from 'react';
import { Copy, Check, Bot } from 'lucide-react';

const ENDPOINT = 'https://brownstones-coffee.netlify.app/api/mcp';

const TOOLS: { name: string; desc: string }[] = [
  { name: 'get_sales_summary', desc: 'Today, yesterday, YTD sales + labor + goal progress' },
  { name: 'get_schedule', desc: "A store's week of shifts vs. recommended hours" },
  { name: 'get_staffing_rules', desc: 'Base headcount rules & targets for a store' },
  { name: 'list_employees', desc: 'Active roster (names, roles, store)' },
  { name: 'list_requests', desc: 'Time-off, swaps, availability, meetings' },
  { name: 'post_announcement', desc: 'Publish a feed announcement' },
  { name: 'set_daily_sales_goal', desc: "Set/clear a store's daily sales goal" },
];

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-cream px-3 py-2">
      <code className="min-w-0 flex-1 truncate text-xs text-brand-800">{value}</code>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="shrink-0 text-brand-400 hover:text-brand-700"
        aria-label="Copy"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

/** Connection details for the agent-facing MCP server (super-admin only). */
export function AgentApiInfo() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-brand-700" />
        <h2 className="font-semibold text-brand-900">Agent connection (MCP)</h2>
      </div>
      <p className="text-sm text-brand-600">
        Connect an AI agent to this app as a tool. Point any MCP-capable client at the endpoint below and send the
        bearer token on every request.
      </p>

      <div>
        <label className="label">Endpoint (Streamable HTTP)</label>
        <CopyRow value={ENDPOINT} />
      </div>

      <div>
        <label className="label">Auth header</label>
        <CopyRow value="Authorization: Bearer <AGENT_API_TOKEN>" />
        <p className="mt-1 text-xs text-brand-500">
          The token is stored securely as the <code className="text-brand-700">AGENT_API_TOKEN</code> environment
          variable in Netlify. Copy its value from there. Rotate it in Netlify to revoke all access.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-brand-800">Available tools</p>
        <ul className="divide-y divide-brand-50 rounded-lg border border-brand-100">
          {TOOLS.map((t) => (
            <li key={t.name} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
              <code className="shrink-0 text-xs font-semibold text-brand-800">{t.name}</code>
              <span className="text-xs text-brand-500">{t.desc}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-brand-400">
        The agent acts through a dedicated super-admin service account, so its reads and writes follow the same
        permissions and audit trail as a person. Full reference: <code className="text-brand-600">docs/agent-mcp.md</code>.
      </p>
    </div>
  );
}
