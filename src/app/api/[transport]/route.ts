import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { isAuthorized, unauthorized } from '@/lib/agent/auth';
import { getSalesSummary, getSchedule, getStaffingRules, listEmployees, listRequests } from '@/lib/agent/queries';
import { createAnnouncement, setDailySalesGoal } from '@/lib/agent/mutations';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({ content: [{ type: 'text' as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true });

const handler = createMcpHandler((server) => {
  // ---- Reads ----
  server.tool(
    'get_sales_summary',
    'Business-wide sales & labor snapshot: today (live), yesterday, year-to-date, and per-store net sales with daily-goal progress. No arguments.',
    {},
    async () => {
      try { return ok(await getSalesSummary()); } catch (e) { return fail(e); }
    }
  );

  server.tool(
    'get_schedule',
    "A store's weekly schedule with every shift plus per-day scheduled vs. recommended hours. Use for coverage/staffing questions.",
    {
      store: z.string().describe('Store name, slug, or id (e.g. "Amityville").'),
      week: z.string().optional().describe('Any date (YYYY-MM-DD) in the target week. Defaults to the current week.'),
    },
    async ({ store, week }) => {
      try { return ok(await getSchedule(store, week)); } catch (e) { return fail(e); }
    }
  );

  server.tool(
    'get_staffing_rules',
    "A store's base staffing rules (required headcount per role per day of week), scheduling notes, daily sales goal, and sales-per-hour targets.",
    { store: z.string().describe('Store name, slug, or id.') },
    async ({ store }) => {
      try { return ok(await getStaffingRules(store)); } catch (e) { return fail(e); }
    }
  );

  server.tool(
    'list_employees',
    'Active roster: names, role(s), and store. Contains no compensation or personal contact details.',
    {
      store: z.string().optional().describe('Limit to one store (name, slug, or id).'),
      active: z.boolean().optional().describe('Set false to include inactive employees. Defaults to active only.'),
    },
    async ({ store, active }) => {
      try { return ok(await listEmployees({ store, active })); } catch (e) { return fail(e); }
    }
  );

  server.tool(
    'list_requests',
    'Pending (or all) requests across the business: time-off, shift swaps, availability, and meeting requests.',
    {
      status: z.enum(['pending', 'approved', 'denied', 'all']).optional().describe('Defaults to pending.'),
      types: z.array(z.enum(['time_off', 'shift_swap', 'availability', 'meeting'])).optional().describe('Limit to specific request types.'),
    },
    async ({ status, types }) => {
      try { return ok(await listRequests({ status, types })); } catch (e) { return fail(e); }
    }
  );

  // ---- Limited actions ----
  server.tool(
    'post_announcement',
    'Publish an announcement to the team feed. Attributed to a super admin. Optionally scope to one store and require acknowledgment (which notifies that audience).',
    {
      body: z.string().describe('The announcement text.'),
      title: z.string().optional().describe('Optional headline.'),
      store: z.string().optional().describe('Scope to one store (name, slug, or id). Omit for all stores.'),
      requires_ack: z.boolean().optional().describe('If true, staff are asked to acknowledge and are notified.'),
    },
    async ({ body, title, store, requires_ack }) => {
      try { return ok(await createAnnouncement({ body, title, store, requires_ack })); } catch (e) { return fail(e); }
    }
  );

  server.tool(
    'set_daily_sales_goal',
    "Set or clear a store's daily sales goal (drives the home-screen celebration when reached).",
    {
      store: z.string().describe('Store name, slug, or id.'),
      amount: z.number().nullable().describe('Dollar goal, or null to clear the goal.'),
    },
    async ({ store, amount }) => {
      try { return ok(await setDailySalesGoal({ store, amount })); } catch (e) { return fail(e); }
    }
  );
}, {}, { basePath: '/api' });

async function authed(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized();
  return handler(req);
}

export { authed as GET, authed as POST, authed as DELETE };
