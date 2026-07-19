import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  ArrowRight,
  BarChart3,
  CalendarPlus,
  UsersRound,
  CircleDot,
  TrendingUp,
  ClipboardCheck,
  CalendarClock,
} from 'lucide-react';
import { Lightbulb } from 'lucide-react';
import { Suspense } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { money, money2, shiftDay, shiftTimeRange, hourLabel, DAY_NAMES } from '@/lib/format';
import type { Shift, Availability } from '@/lib/database.types';
import { StoreBoard } from './store-board';
import { YtdChart } from './ytd-chart';
import { FeedPreview } from './feed-preview';
import { AckPrompt } from './ack-prompt';
import { CollapsibleSection } from './collapsible-section';
import { WeekStrip, type StripDay } from '../schedule/week-strip';
import { getYelpBusiness, yelpConfigured } from '@/lib/yelp';
import { Stars } from '@/components/stars';
import { OfferShift, ProposeSwap } from '../schedule/shift-actions';

export const dynamic = 'force-dynamic';

type OnPerson = { name: string; in_at: string | null; role: string | null; dept: string | null };
type Store = { id: string; name: string; net: number; prev: number; on_now: number; on_foh: number; on_boh: number; on_mgmt: number; on: OnPerson[] };
type Summary = {
  today: { date: string; net: number; checks: number; labor_pct: number; on_now: number };
  prev: { date: string; net: number; checks: number };
  clocked_total: number;
  stores: Store[];
  ytd: { net: number; checks: number; avg: number; monthly: { ym: string; net: number; checks: number }[] };
  labor: { pct: number; weekly: { wk: string; pct: number }[] };
  synced_at: string | null;
};

const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '—';

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = (profile.display_name || profile.full_name || 'there').split(' ')[0];
  const manager = canManage(profile.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Hi, {firstName} 👋</h1>
        <p className="text-sm text-brand-600">{manager ? "Here's how the business is doing." : "Here's what's coming up."}</p>
      </div>

      <AckPrompt />

      {manager ? <OpsHome isSuper={profile.role === 'super_admin'} primaryLocationId={profile.primary_location_id} /> : <EmployeeHome profileId={profile.id} primaryLocationId={profile.primary_location_id} />}
    </div>
  );
}

async function OpsHome({ isSuper, primaryLocationId }: { isSuper: boolean; primaryLocationId: string | null }) {
  const supabase = await createClient();
  const [{ data }, pendingApprovals, coverage, { data: goalRows }] = await Promise.all([
    supabase.rpc('home_summary'),
    countPendingApprovals(supabase),
    lastWeekCoverage(supabase, isSuper, primaryLocationId),
    supabase.from('locations').select('id, daily_sales_goal').eq('is_active', true),
  ]);
  const s = (data ?? null) as Summary | null;
  if (!s) return <div className="card text-center text-sm text-brand-500">No data yet.</div>;

  const hasCoverage = coverage.some((c) => c.days.some((d) => d.sched > 0 || d.reco > 0));

  // Daily sales goals reached today — celebrate on the home screen.
  const goalById = new Map(((goalRows ?? []) as { id: string; daily_sales_goal: number | null }[]).map((g) => [g.id, Number(g.daily_sales_goal) || 0]));
  const goalsHit = s.stores
    .filter((st) => (goalById.get(st.id) ?? 0) > 0 && st.net >= (goalById.get(st.id) ?? 0))
    .map((st) => ({ name: st.name, net: st.net, goal: goalById.get(st.id) ?? 0 }));

  return (
    <div className="space-y-4">
    {goalsHit.length > 0 && (
      <div className="rounded-2xl border border-gold-300 bg-gradient-to-r from-gold-100 to-cream px-4 py-3 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
          <span className="text-lg">🎉</span>
          {goalsHit.length === 1 ? `${goalsHit[0].name} hit its daily sales goal!` : `${goalsHit.length} stores hit their daily sales goal!`}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-brand-700">
          {goalsHit.map((g) => (
            <span key={g.name} className="tabular-nums">
              <span className="font-semibold">{g.name}</span> · {money2(g.net)} of {money2(g.goal)}
            </span>
          ))}
        </div>
      </div>
    )}
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
      {/* ---- Left column: live numbers ---- */}
      <div className="space-y-4">
        {/* Today (live) + yesterday */}
        <div className="card bg-brand-700 text-white">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-200">Net sales · Today (live)</p>
            <span className="flex items-center gap-1 text-xs text-gold-200">
              <CircleDot size={12} className="text-green-300" /> {s.clocked_total} on the clock
            </span>
          </div>
          <p className="mt-1 text-3xl font-bold tabular-nums">{money2(s.today.net)}</p>
          {s.today.net === 0 ? (
            <p className="mt-1 text-xs text-gold-200">No sales synced yet today.</p>
          ) : (
            <p className="mt-1 text-xs text-gold-100">Labor {s.today.labor_pct > 0 ? `${s.today.labor_pct}%` : '—'}</p>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2 text-sm">
            <span className="text-gold-100">Yesterday</span>
            <span className="font-semibold tabular-nums">{money2(s.prev.net)}</span>
          </div>
          <p className="mt-2 text-[11px] text-gold-200/80">As of {fmtTime(s.synced_at)} · live from Toast</p>
        </div>

        {/* By store — exact numbers + tap to see who's on now */}
        {s.stores.length > 1 && (
          <CollapsibleSection title="By store · today" storageKey="bystore" summary={`${s.stores.length} stores`} linkHref="/insights" linkLabel="Insights">
            <StoreBoard stores={s.stores} />
          </CollapsibleSection>
        )}

        {/* How last week's coverage went — one strip per store */}
        {hasCoverage && (
          <CollapsibleSection title="Last week's coverage" storageKey="coverage-v2" defaultOpen summary="hours worked vs recommended" linkHref="/schedule?view=week" linkLabel="Schedule">
            <div className="card space-y-3">
              <div>
                <p className="text-xs text-brand-500">Hours actually worked vs. recommended, per day. The number is hours worked; &ldquo;of Nh&rdquo; is what demand recommended.</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-brand-500">
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-green-100 ring-1 ring-green-300" /> On target</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-brick-500/10 ring-1 ring-brick-400" /> Understaffed</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-amber-100 ring-1 ring-amber-400" /> Overstaffed</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-brand-50 ring-1 ring-brand-200" /> No recommendation</span>
                </div>
              </div>
              {coverage.map((c) => (
                <div key={c.id} className="border-t border-brand-50 pt-3 first:border-0 first:pt-0">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-500">{c.name}</p>
                  <WeekStrip days={c.days} compact />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* ---- Right column: trends, actions, feed ---- */}
      <div className="space-y-4">
        {/* Year to date */}
        <section>
          <div className="card">
            <h2 className="mb-3 font-semibold text-brand-900">Year to date</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-brand-900">{money(s.ytd.net)}</p>
                <p className="mt-0.5 text-xs text-brand-500">sales</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-brand-900">{money2(s.ytd.avg)}</p>
                <p className="mt-0.5 text-xs text-brand-500">avg ticket</p>
              </div>
              <div>
                <p className={`text-lg font-bold tabular-nums ${s.labor.pct <= 30 ? 'text-brand-900' : 'text-brick-600'}`}>
                  {s.labor.pct > 0 ? `${s.labor.pct}%` : '—'}
                </p>
                <p className="mt-0.5 text-xs text-brand-500">labor · 8 wk</p>
              </div>
            </div>
            <div className="mt-4">
              <YtdChart monthly={s.ytd.monthly} weekly={s.labor.weekly} />
            </div>
          </div>
        </section>

        {/* What to act on (streams in from the insights engine) */}
        <Suspense fallback={<div className="card h-28 animate-pulse bg-brand-50" />}>
          <ActOnList isSuper={isSuper} primaryLocationId={primaryLocationId} />
        </Suspense>

        {/* Yelp ratings (streams in; hidden until Yelp is connected) */}
        <Suspense fallback={null}>
          <YelpHomeWidget isSuper={isSuper} primaryLocationId={primaryLocationId} />
        </Suspense>

        {/* Quick actions */}
        <section>
          <h2 className="mb-2 font-semibold text-brand-900">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/approvals" icon={<ClipboardCheck size={20} />} label="Approvals" badge={pendingApprovals} />
            <QuickAction href="/insights" icon={<BarChart3 size={20} />} label="Insights" />
            <QuickAction href="/schedule/build" icon={<CalendarPlus size={20} />} label="Build schedule" />
            <QuickAction href="/schedule/staffing" icon={<TrendingUp size={20} />} label="Staffing needs" />
            <QuickAction href="/roster" icon={<UsersRound size={20} />} label="Roster" />
            <QuickAction href="/meetings" icon={<CalendarClock size={20} />} label="Meetings" />
          </div>
        </section>

        {/* Live feed */}
        <FeedPreview />
      </div>
    </div>
    </div>
  );
}

type StoreCoverage = { id: string; name: string; days: StripDay[] };

async function lastWeekCoverage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  isSuper: boolean,
  primaryLocationId: string | null
): Promise<StoreCoverage[]> {
  const { data: locs } = await supabase.from('locations').select('id, name, labor_target_splh').eq('is_active', true).order('name');
  let list = (locs ?? []) as { id: string; name: string; labor_target_splh: number }[];
  if (!isSuper) {
    // Managers only ever see their own store (never someone else's).
    list = list.filter((l) => l.id === primaryLocationId);
  }
  if (!list.length) return [];

  const monday = startOfWeek(addDays(new Date(), -7), { weekStartsOn: 1 });
  const ids = list.map((l) => l.id);
  const mondayStr = format(monday, 'yyyy-MM-dd');
  const sundayStr = format(addDays(monday, 6), 'yyyy-MM-dd');
  // Actual hours worked (from Toast time entries) vs recommended — real history.
  const [{ data: teData }, recos] = await Promise.all([
    supabase.from('toast_time_entries').select('location_id, business_date, regular_hours, overtime_hours').in('location_id', ids).gte('business_date', mondayStr).lte('business_date', sundayStr).eq('deleted', false),
    Promise.all(list.map((l) => supabase.rpc('staffing_reco', { p_location: l.id, p_target: Number(l.labor_target_splh) || 130 }))),
  ]);
  const entries = (teData as { location_id: string; business_date: string; regular_hours: number | null; overtime_hours: number | null }[]) ?? [];

  return list.map((l, idx) => {
    const grid = ((recos[idx].data as { grid?: { dow: number; reco: number }[] })?.grid ?? []);
    const recoByDow = new Map<number, number>();
    for (const g of grid) recoByDow.set(g.dow, (recoByDow.get(g.dow) ?? 0) + g.reco);
    const byDay = new Map<string, number>();
    for (const e of entries) {
      if (e.location_id !== l.id) continue;
      byDay.set(e.business_date, (byDay.get(e.business_date) ?? 0) + (Number(e.regular_hours) || 0) + (Number(e.overtime_hours) || 0));
    }
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      const key = format(d, 'yyyy-MM-dd');
      return { key, abbr: format(d, 'EEE'), sched: byDay.get(key) ?? 0, reco: recoByDow.get(d.getDay()) ?? 0, count: 0 };
    });
    return { id: l.id, name: l.name, days };
  });
}

type ActData = {
  net: number;
  by_dow: { dow: number; net: number }[];
  by_hour: { hour: number; net: number }[];
  daypart: { breakfast: number; lunch: number };
  labor: { pct: number; splh: number };
  top_sellers: { name: string; net: number }[];
  forecast: { id: string; proj: number }[];
};

/** "What to act on" — a short, ranked digest from the insights engine. Streams in. */
async function ActOnList({ isSuper, primaryLocationId }: { isSuper: boolean; primaryLocationId: string | null }) {
  const supabase = await createClient();
  const store = isSuper ? null : primaryLocationId;
  const [{ data: rpc }, { data: locs }] = await Promise.all([
    supabase.rpc('insights', { p_range: 'month', p_location: store }),
    supabase.from('locations').select('id, name'),
  ]);
  const d = rpc as ActData | null;
  if (!d || Number(d.net) <= 0) return null;
  const nameById = new Map(((locs ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name]));

  const peakDow = (d.by_dow ?? []).reduce((a, r) => (Number(r.net) > Number(a.net) ? r : a), { dow: -1, net: 0 });
  const peakHour = (d.by_hour ?? []).reduce((a, r) => (Number(r.net) > Number(a.net) ? r : a), { hour: -1, net: 0 });
  const breakfast = Number(d.daypart?.breakfast ?? 0);
  const lunch = Number(d.daypart?.lunch ?? 0);
  const dpTot = breakfast + lunch || 1;
  const bPct = Math.round((breakfast / dpTot) * 100);
  const labor = { pct: Number(d.labor?.pct ?? 0), splh: Number(d.labor?.splh ?? 0) };
  const topSellers = (d.top_sellers ?? []).map((t) => ({ name: t.name, net: Number(t.net) }));
  const forecast = d.forecast ?? [];

  const actions: string[] = [];
  if (peakDow.dow >= 0 && peakDow.net > 0) actions.push(`${DAY_NAMES[peakDow.dow]} is the strongest day (${money(peakDow.net)}/day avg) — keep it fully staffed.`);
  if (peakHour.hour >= 0) actions.push(`Demand peaks at ${hourLabel(peakHour.hour)} — schedule your highest-rated team then.`);
  if (dpTot > 1) actions.push(`${bPct >= 50 ? 'Breakfast' : 'Lunch'} drives ${Math.max(bPct, 100 - bPct)}% of sales.`);
  if (labor.splh > 0)
    actions.push(
      labor.pct <= 30
        ? `Labor is a healthy ${labor.pct}% of sales (${money2(labor.splh)}/labor hr).`
        : `Labor is ${labor.pct}% of sales — above the 30% target; tighten scheduling on slower days.`
    );
  if (topSellers.length) actions.push(`${topSellers[0].name} is your top seller (${money(topSellers[0].net)}) — never 86 it.`);
  if (forecast.length && !store) actions.push(`Next week, ${nameById.get(forecast[0].id) ?? 'the top store'} is projected highest (${money(forecast[0].proj)}).`);
  if (!actions.length) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-semibold text-brand-900"><Lightbulb size={16} className="text-gold-500" /> What to act on</h2>
        <Link href="/insights" className="flex items-center gap-1 text-sm font-medium text-brand-700">Insights <ArrowRight size={14} /></Link>
      </div>
      <div className="card">
        <ul className="space-y-2.5">
          {actions.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm text-brand-800">
              <span className="text-gold-500">•</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Compact Yelp rating per store. Renders nothing until Yelp is connected. */
async function YelpHomeWidget({ isSuper, primaryLocationId }: { isSuper: boolean; primaryLocationId: string | null }) {
  if (!yelpConfigured()) return null;
  const supabase = await createClient();
  const { data: locs } = await supabase.from('locations').select('id, name, yelp_url, yelp_business_id').eq('is_active', true).order('name');
  let list = ((locs ?? []) as { id: string; name: string; yelp_url: string | null; yelp_business_id: string | null }[]).filter((l) => l.yelp_business_id);
  if (!isSuper) list = list.filter((l) => l.id === primaryLocationId);
  if (!list.length) return null;

  const rows = (await Promise.all(list.map(async (l) => ({ l, biz: await getYelpBusiness(l.yelp_business_id!) }))))
    .filter((r) => r.biz);
  if (!rows.length) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-brand-900">Yelp ratings</h2>
        <Link href="/reviews" className="flex items-center gap-1 text-sm font-medium text-brand-700">Reviews <ArrowRight size={14} /></Link>
      </div>
      <div className="card divide-y divide-brand-50">
        {rows.map(({ l, biz }) => (
          <div key={l.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <span className="min-w-0 truncate text-sm font-medium text-brand-800">{l.name}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Stars rating={biz!.rating} size={13} />
              <span className="text-sm font-bold tabular-nums text-brand-900">{biz!.rating.toFixed(1)}</span>
              <span className="text-xs text-brand-400">({biz!.review_count.toLocaleString()})</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

async function countPendingApprovals(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  const head = { count: 'exact' as const, head: true };
  const [a, b, c] = await Promise.all([
    supabase.from('time_off_requests').select('*', head).eq('status', 'pending'),
    supabase.from('availability').select('*', head).eq('status', 'pending'),
    supabase.from('shift_swap_requests').select('*', head).eq('status', 'pending'),
  ]);
  return (a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0);
}

function QuickAction({ href, icon, label, badge }: { href: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Link href={href} className="card flex items-center gap-3 py-3 hover:border-brand-300">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
        {icon}
        {badge ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brick-600 px-1 text-[10px] font-bold text-white">{badge}</span>
        ) : null}
      </span>
      <span className="font-medium text-brand-900">{label}</span>
    </Link>
  );
}

async function EmployeeHome({ profileId, primaryLocationId }: { profileId: string; primaryLocationId: string | null }) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: myEmps } = await supabase.from('employees').select('id').eq('profile_id', profileId);
  const myEmpIds = (myEmps ?? []).map((e) => e.id);
  const [{ data: myShifts }, { data: avail }, { data: mtgData }, { data: offerData }, { data: candData }] = await Promise.all([
    supabase.from('shifts').select('*').eq('employee_id', profileId).gte('ends_at', nowIso).order('starts_at').limit(3),
    supabase.from('availability').select('*').eq('profile_id', profileId),
    myEmpIds.length
      ? supabase.from('meetings').select('id, type, scheduled_at, location').in('employee_id', myEmpIds).eq('status', 'scheduled').order('scheduled_at').limit(3)
      : Promise.resolve({ data: [] }),
    supabase.from('shift_swap_requests').select('id, shift_id').eq('requested_by', profileId).eq('status', 'pending').is('requested_to', null),
    primaryLocationId
      ? supabase.from('shifts').select('id, starts_at, ends_at, employee:profiles!shifts_employee_id_fkey(display_name, full_name)').eq('location_id', primaryLocationId).eq('status', 'published').not('employee_id', 'is', null).neq('employee_id', profileId).gt('starts_at', nowIso).order('starts_at')
      : Promise.resolve({ data: [] }),
  ]);
  const shifts = (myShifts as Shift[]) ?? [];
  const offerByShift = new Map<string, string>();
  for (const o of (offerData ?? []) as { id: string; shift_id: string }[]) offerByShift.set(o.shift_id, o.id);
  const swapCandidates = ((candData ?? []) as unknown as { id: string; starts_at: string; ends_at: string; employee: { display_name: string | null; full_name: string | null } | null }[])
    .map((s) => ({ id: s.id, label: `${s.employee?.display_name || s.employee?.full_name || 'Coworker'} · ${shiftDay(s.starts_at)} · ${shiftTimeRange(s.starts_at, s.ends_at)}` }));
  const availability = (avail as Availability[]) ?? [];
  const meetings = (mtgData as { id: string; type: string; scheduled_at: string | null; location: string | null }[]) ?? [];
  const MTG_LABEL: Record<string, string> = { review: 'Employee review', disciplinary: 'Disciplinary meeting', training: 'Training', discussion: 'Discussion', other: 'Meeting' };
  const mtgWhen = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : 'Time TBD';
  const availStatus = availability.length
    ? availability.some((a) => a.status === 'pending')
      ? { text: 'Pending approval', cls: 'bg-amber-100 text-amber-700' }
      : availability.some((a) => a.status === 'denied')
        ? { text: 'Needs changes', cls: 'bg-brick-500/15 text-brick-600' }
        : { text: 'Approved', cls: 'bg-green-100 text-green-700' }
    : null;

  return (
    <>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Your next shifts</h2>
          <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
            Full schedule <ArrowRight size={14} />
          </Link>
        </div>
        {shifts.length > 0 ? (
          <ul className="space-y-3">
            {shifts.map((s) => {
              const future = new Date(s.starts_at).getTime() > Date.now();
              return (
                <li key={s.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex flex-col items-center rounded-xl bg-brand-700 px-3 py-2 text-white">
                    <CalendarDays size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-900">{shiftDay(s.starts_at)}</p>
                    <p className="flex items-center gap-1 text-sm text-brand-600">
                      <Clock size={14} /> {shiftTimeRange(s.starts_at, s.ends_at)}
                    </p>
                  </div>
                  {s.status === 'draft' ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Draft</span>
                  ) : future ? (
                    <>
                      <OfferShift shiftId={s.id} offerId={offerByShift.get(s.id) ?? null} />
                      {!offerByShift.get(s.id) && swapCandidates.length > 0 && <ProposeSwap myShiftId={s.id} candidates={swapCandidates} />}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="card text-center text-sm text-brand-500">No upcoming shifts scheduled yet.</div>
        )}
      </section>

      {/* Upcoming meetings */}
      {meetings.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-brand-900">Upcoming meetings</h2>
          <ul className="space-y-2">
            {meetings.map((m) => (
              <li key={m.id} className="card flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <CalendarDays size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-900">{MTG_LABEL[m.type] ?? 'Meeting'}</p>
                  <p className="text-xs text-brand-500">{mtgWhen(m.scheduled_at)}{m.location ? ` · ${m.location}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Live feed */}
      <FeedPreview />

      <Link href="/profile" className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-brand-900">My availability</p>
          <p className="text-sm text-brand-500">Set the days &amp; hours you can work</p>
        </div>
        {availStatus ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${availStatus.cls}`}>{availStatus.text}</span>
        ) : (
          <span className="flex items-center gap-1 text-sm font-medium text-brand-700">Set it <ArrowRight size={14} /></span>
        )}
      </Link>
    </>
  );
}
