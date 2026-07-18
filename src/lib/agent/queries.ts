import { agentClient } from './client';
import { format, startOfWeek, parseISO, addDays } from 'date-fns';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Sb = Awaited<ReturnType<typeof agentClient>>['sb'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a store reference (uuid, slug, or name) to a location row. Throws a clear error if not found. */
export async function resolveStore(sb: Sb, ref: string): Promise<{ id: string; name: string; slug: string | null }> {
  const { data } = await sb.from('locations').select('id, name, slug').eq('is_active', true);
  const list = (data ?? []) as { id: string; name: string; slug: string | null }[];
  const needle = ref.trim().toLowerCase();
  const hit =
    (UUID_RE.test(ref) && list.find((l) => l.id === ref)) ||
    list.find((l) => l.slug?.toLowerCase() === needle) ||
    list.find((l) => l.name.toLowerCase() === needle) ||
    list.find((l) => l.name.toLowerCase().includes(needle));
  if (!hit) throw new Error(`No active store matches "${ref}". Options: ${list.map((l) => l.name).join(', ')}.`);
  return hit;
}

function mondayOf(week?: string): string {
  const base = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? parseISO(week) : new Date();
  return format(startOfWeek(base, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/** Business-wide sales & labor snapshot: today (live), yesterday, YTD, per store, and goal progress. */
export async function getSalesSummary() {
  const { sb } = await agentClient();
  const [{ data: summary }, { data: locs }] = await Promise.all([
    sb.rpc('home_summary'),
    sb.from('locations').select('id, name, daily_sales_goal').eq('is_active', true),
  ]);
  const s = (summary ?? {}) as any;
  const goalById = new Map(((locs ?? []) as any[]).map((l) => [l.id, Number(l.daily_sales_goal) || 0]));
  const stores = ((s.stores ?? []) as any[]).map((st) => {
    const goal = goalById.get(st.id) ?? 0;
    return {
      store: st.name,
      net_today: st.net ?? 0,
      net_prev_day: st.prev ?? 0,
      on_the_clock: st.on_now ?? 0,
      daily_goal: goal || null,
      goal_reached: goal > 0 ? (st.net ?? 0) >= goal : null,
    };
  });
  return {
    today: { date: s.today?.date ?? null, net_sales: s.today?.net ?? 0, checks: s.today?.checks ?? 0, labor_pct: s.today?.labor_pct ?? null, on_the_clock: s.clocked_total ?? 0 },
    yesterday: { date: s.prev?.date ?? null, net_sales: s.prev?.net ?? 0, checks: s.prev?.checks ?? 0 },
    year_to_date: { net_sales: s.ytd?.net ?? 0, checks: s.ytd?.checks ?? 0, avg_ticket: s.ytd?.avg ?? 0, labor_pct_8wk: s.labor?.pct ?? null },
    by_store: stores,
    synced_at: s.synced_at ?? null,
  };
}

/** Published + draft schedule for a store's week, with per-day scheduled hours vs recommended. */
export async function getSchedule(storeRef: string, week?: string) {
  const { sb } = await agentClient();
  const store = await resolveStore(sb, storeRef);
  const monday = mondayOf(week);
  const { data: locRow } = await sb.from('locations').select('labor_target_splh').eq('id', store.id).maybeSingle();
  const target = Number((locRow as any)?.labor_target_splh) || 130;
  const [{ data: shiftData }, { data: recoData }] = await Promise.all([
    sb.rpc('week_shifts', { p_location: store.id, p_monday: monday }),
    sb.rpc('staffing_reco', { p_location: store.id, p_target: target }),
  ]);
  const shifts = ((shiftData ?? []) as any[]).map((s) => ({
    day: s.day,
    employee: s.employee ?? 'Unassigned',
    role: s.role ?? null,
    start: s.starts_at,
    end: s.ends_at,
    break_minutes: s.break_minutes ?? 0,
    status: s.status,
  }));
  const recoByDow = new Map<number, number>();
  for (const g of ((recoData as any)?.grid ?? [])) recoByDow.set(g.dow, (recoByDow.get(g.dow) ?? 0) + g.reco);
  const hrs = (s: any) => Math.max(0, (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000 - (s.break_minutes || 0) / 60);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(parseISO(monday), i);
    const iso = format(d, 'yyyy-MM-dd');
    const dayShifts = shifts.filter((s) => s.day === iso);
    return {
      date: iso,
      weekday: format(d, 'EEEE'),
      scheduled_hours: Number(dayShifts.reduce((n, s) => n + hrs(s), 0).toFixed(1)),
      recommended_hours: Math.round(recoByDow.get(d.getDay()) ?? 0),
      shift_count: dayShifts.length,
    };
  });
  return { store: store.name, week_of: monday, days, shifts };
}

/** Base staffing rules (headcount per role per day) + free-text notes for a store. */
export async function getStaffingRules(storeRef: string) {
  const { sb } = await agentClient();
  const store = await resolveStore(sb, storeRef);
  const [{ data: rules }, { data: loc }] = await Promise.all([
    sb.from('staffing_rules').select('role, mon, tue, wed, thu, fri, sat, sun').eq('location_id', store.id).order('sort_order'),
    sb.from('locations').select('staffing_notes, daily_sales_goal, revenue_per_hour_target, labor_target_splh').eq('id', store.id).maybeSingle(),
  ]);
  return {
    store: store.name,
    notes: (loc as any)?.staffing_notes ?? null,
    daily_sales_goal: (loc as any)?.daily_sales_goal ?? null,
    sales_per_hour_per_server: (loc as any)?.revenue_per_hour_target ?? null,
    sales_per_labor_hour_target: (loc as any)?.labor_target_splh ?? null,
    rules: (rules ?? []) as any[],
  };
}

/** Active roster: name, role(s), and store. No compensation or personal contact info. */
export async function listEmployees(opts?: { store?: string; active?: boolean }) {
  const { sb } = await agentClient();
  let storeId: string | null = null;
  let storeName: string | null = null;
  if (opts?.store) { const s = await resolveStore(sb, opts.store); storeId = s.id; storeName = s.name; }
  const { data: locs } = await sb.from('locations').select('id, name');
  const nameById = new Map(((locs ?? []) as any[]).map((l) => [l.id, l.name]));
  let q = sb.from('employees').select('first_name, last_name, role_title, role_titles, location_id, active').order('first_name');
  if (storeId) q = q.eq('location_id', storeId);
  if (opts?.active !== false) q = q.eq('active', true);
  const { data } = await q;
  const people = ((data ?? []) as any[]).map((e) => ({
    name: `${e.first_name} ${e.last_name ?? ''}`.trim(),
    roles: (e.role_titles?.length ? e.role_titles : e.role_title ? [e.role_title] : []) as string[],
    store: nameById.get(e.location_id) ?? null,
    active: e.active,
  }));
  return { store: storeName, count: people.length, employees: people };
}

/** Open/pending requests across the business: time-off, shift swaps, availability, meetings. */
export async function listRequests(opts?: { status?: string; types?: string[] }) {
  const { sb } = await agentClient();
  const status = opts?.status ?? 'pending';
  const want = (t: string) => !opts?.types?.length || opts.types.includes(t);
  const statusFilter = <T>(q: any): T => (status === 'all' ? q : q.eq('status', status));

  const [timeOff, swaps, avail, meetings] = await Promise.all([
    want('time_off') ? statusFilter(sb.from('time_off_requests').select('id, profile_id, start_date, end_date, reason, status, created_at')) : Promise.resolve({ data: [] }),
    want('shift_swap') ? statusFilter(sb.from('shift_swap_requests').select('id, requester_id, shift_id, reason, status, created_at')) : Promise.resolve({ data: [] }),
    want('availability') ? statusFilter(sb.from('availability').select('id, profile_id, day_of_week, start_time, end_time, status')) : Promise.resolve({ data: [] }),
    want('meeting') ? statusFilter(sb.from('meetings').select('id, type, scheduled_at, location, status, employee_id')) : Promise.resolve({ data: [] }),
  ]);
  return {
    status,
    time_off: (timeOff as any).data ?? [],
    shift_swaps: (swaps as any).data ?? [],
    availability: (avail as any).data ?? [],
    meetings: (meetings as any).data ?? [],
  };
}
