import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { money, money2, moneyShort, hourLabel, monthAbbr, shiftDay, DOW_ABBR, DAY_NAMES } from '@/lib/format';
import type { Location } from '@/lib/database.types';
import { InsightsFilter } from './insights-filter';
import { SyncButton } from './sync-button';
import { BarChart, Sparkline, type Bar } from './chart';

export const dynamic = 'force-dynamic';

type InsightsData = {
  range: string;
  location: string | null;
  start_date: string;
  latest_date: string;
  net: number;
  checks: number;
  by_hour: { hour: number; net: number }[];
  by_dow: { dow: number; net: number }[];
  daily: { date: string; net: number }[];
  monthly: { ym: string; net: number }[];
  daypart: { breakfast: number; lunch: number };
  leaderboard: { id: string; net: number }[];
  top_sellers: { name: string; units: number; net: number }[];
  labor: { cost: number; hours: number; pct: number; splh: number };
  labor_daily: { date: string; cost: number; hours: number }[];
  forecast: { id: string; proj: number; days: { dow: number; net: number }[] }[];
};

function Kpi({ label, value, sub, dim }: { label: string; value: string; sub?: string; dim?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${dim ? 'text-brand-300' : 'text-brand-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-brand-500">{sub}</p>}
    </div>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-brand-900">{title}</h2>
        {meta && <span className="text-xs text-brand-400">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/** Normalize a forecast day list to 7 Sun–Sat bars. */
function toDowBars(days: { dow: number; net: number }[]) {
  const m = new Map(days.map((d) => [d.dow, Number(d.net)]));
  const rows = Array.from({ length: 7 }, (_, i) => ({ dow: i, net: m.get(i) ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.net));
  const peak = rows.reduce((a, r) => (r.net > a.net ? r : a), { dow: -1, net: 0 }).dow;
  const bars: Bar[] = rows.map((r) => ({ label: DOW_ABBR[r.dow], full: DAY_NAMES[r.dow], value: r.net, peak: r.dow === peak }));
  return { bars, max, peak };
}

const RANGE_LABEL: Record<string, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  year: 'last 12 months',
};

const pct1 = (n: number) => `${n.toFixed(1)}%`;
const pct0 = (n: number) => `${Math.round(n)}%`;

/** Placeholder shown while the (streamed) data sections load. */
function InsightsSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="card h-24 bg-brand-700/90" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-20" />
        ))}
      </div>
      <div className="card h-56" />
      <div className="card h-28" />
      <div className="card h-56" />
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const range = ['today', 'week', 'month', 'year'].includes(sp.range ?? '') ? sp.range! : 'year';
  const store = sp.store && sp.store !== 'all' ? sp.store : null;

  // Fast, tiny query so the shell (header + filter) can render immediately.
  const supabase = await createClient();
  const { data: locsRes } = await supabase.from('locations').select('id, name').eq('is_active', true);
  const locations = (locsRes ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Insights</h1>
          <p className="text-sm text-brand-600">
            {store ? nameById.get(store) ?? 'Store' : 'All stores'} · {RANGE_LABEL[range]}
          </p>
        </div>
        <SyncButton />
      </div>

      <InsightsFilter locations={locations} />

      {/* The heavy data (insights RPC + charts) streams in; the shell above is instant.
          Keying on range+store re-shows the skeleton on every filter change. */}
      <Suspense key={`${range}:${store ?? 'all'}`} fallback={<InsightsSkeleton />}>
        <InsightsContent range={range} store={store} locations={locations} />
      </Suspense>
    </div>
  );
}

async function InsightsContent({
  range,
  store,
  locations,
}: {
  range: string;
  store: string | null;
  locations: Pick<Location, 'id' | 'name'>[];
}) {
  const nameById = new Map(locations.map((l) => [l.id, l.name]));

  const supabase = await createClient();
  const { data: rpcData } = await supabase.rpc('insights', { p_range: range, p_location: store });
  const d = (rpcData ?? null) as InsightsData | null;

  const net = Number(d?.net ?? 0);
  const checks = Number(d?.checks ?? 0);
  const avgCheck = checks > 0 ? net / checks : 0;
  const hasData = net > 0;

  // Adaptive sales trend.
  let trendBars: Bar[] = [];
  let trendMax = 1;
  let trendEvery = 1;
  let trendMeta = '';
  if (d) {
    if (range === 'today') {
      const rows = d.by_hour;
      trendMax = Math.max(1, ...rows.map((r) => r.net));
      const peak = rows.reduce((a, r) => (r.net > a.net ? r : a), { hour: -1, net: 0 });
      trendBars = rows.map((r) => ({ label: hourLabel(r.hour), value: r.net, peak: r.hour === peak.hour }));
      trendMeta = 'by hour';
    } else if (range === 'year') {
      const rows = [...d.monthly].sort((a, b) => a.ym.localeCompare(b.ym)).slice(-12);
      trendMax = Math.max(1, ...rows.map((r) => r.net));
      const peak = rows.reduce((a, r) => (r.net > a.net ? r : a), { ym: '', net: 0 });
      trendBars = rows.map((r) => ({ label: monthAbbr(r.ym), full: `${monthAbbr(r.ym)} ${r.ym.slice(0, 4)}`, value: r.net, peak: r.ym === peak.ym }));
      trendMeta = 'monthly';
    } else {
      const rows = [...d.daily].sort((a, b) => a.date.localeCompare(b.date));
      trendMax = Math.max(1, ...rows.map((r) => r.net));
      const last = rows[rows.length - 1]?.date;
      trendBars = rows.map((r) => ({ label: `${Number(r.date.slice(8, 10))}`, full: shiftDay(r.date + 'T12:00:00'), value: r.net, peak: r.date === last }));
      trendEvery = range === 'month' ? 5 : 1;
      trendMeta = 'daily';
    }
  }

  // Day of week (range-independent, 8-week average from the RPC).
  const dowRows = Array.from({ length: 7 }, (_, i) => ({ dow: i, net: Number(d?.by_dow.find((x) => x.dow === i)?.net ?? 0) }));
  const dowMax = Math.max(1, ...dowRows.map((r) => r.net));
  const peakDow = dowRows.reduce((a, r) => (r.net > a.net ? r : a), { dow: -1, net: 0 });
  const dowBars: Bar[] = dowRows.map((r) => ({ label: DOW_ABBR[r.dow], full: DAY_NAMES[r.dow], value: r.net, peak: r.dow === peakDow.dow }));

  const peakHour = (d?.by_hour ?? []).reduce((a, r) => (r.net > a.net ? r : a), { hour: -1, net: 0 });

  const breakfast = Number(d?.daypart.breakfast ?? 0);
  const lunch = Number(d?.daypart.lunch ?? 0);
  const dpTot = breakfast + lunch || 1;
  const bPct = Math.round((breakfast / dpTot) * 100);

  const board = (d?.leaderboard ?? []).map((r) => ({ name: nameById.get(r.id) ?? '—', net: Number(r.net) }));
  const boardMax = Math.max(1, ...board.map((b) => b.net));
  const multi = board.length > 1 && !store;

  const topSellers = (d?.top_sellers ?? []).map((t) => ({ name: t.name, units: Number(t.units), net: Number(t.net) }));
  const topMax = Math.max(1, ...topSellers.map((t) => t.net));

  // Labor (from Toast punch records).
  const labor = {
    cost: Number(d?.labor?.cost ?? 0),
    hours: Number(d?.labor?.hours ?? 0),
    pct: Number(d?.labor?.pct ?? 0),
    splh: Number(d?.labor?.splh ?? 0),
  };
  const hasLabor = labor.hours > 0;
  const netByDate = new Map((d?.daily ?? []).map((x) => [x.date, Number(x.net)]));
  const laborTrendRows = (d?.labor_daily ?? [])
    .map((x) => {
      const dayNet = netByDate.get(x.date) ?? 0;
      return { date: x.date, pct: dayNet > 0 ? (Number(x.cost) / dayNet) * 100 : 0 };
    })
    .filter((r) => r.pct > 0);
  const laborTrendMax = Math.max(1, ...laborTrendRows.map((r) => r.pct));
  const laborPeak = laborTrendRows.reduce((a, r) => (r.pct > a.pct ? r : a), { date: '', pct: 0 });
  const laborBars: Bar[] = laborTrendRows.map((r) => ({
    label: `${Number(r.date.slice(8, 10))}`,
    full: shiftDay(r.date + 'T12:00:00'),
    value: r.pct,
    peak: r.date === laborPeak.date,
  }));
  const showLaborTrend = (range === 'week' || range === 'month') && laborBars.length > 1;

  const forecast = d?.forecast ?? [];
  const projTotal = forecast.reduce((s, f) => s + Number(f.proj), 0);

  // "What to act on"
  const actions: string[] = [];
  if (peakDow.dow >= 0 && peakDow.net > 0) actions.push(`${DAY_NAMES[peakDow.dow]} is the strongest day (${money(peakDow.net)}/day avg) — keep it fully staffed.`);
  if (peakHour.hour >= 0) actions.push(`Demand peaks at ${hourLabel(peakHour.hour)} — schedule your highest-rated team then.`);
  if (dpTot > 1) actions.push(`${bPct >= 50 ? 'Breakfast' : 'Lunch'} drives ${Math.max(bPct, 100 - bPct)}% of sales.`);
  if (hasLabor)
    actions.push(
      labor.pct <= 30
        ? `Labor is a healthy ${labor.pct}% of sales (${money2(labor.splh)}/labor hr).`
        : `Labor is ${labor.pct}% of sales — above the 30% target; tighten scheduling on slower days.`
    );
  if (topSellers.length) actions.push(`${topSellers[0].name} is your top seller (${money(topSellers[0].net)}) — never 86 it.`);
  if (forecast.length && !store) actions.push(`Next week, ${nameById.get(forecast[0].id) ?? 'the top store'} is projected highest (${money(forecast[0].proj)}).`);

  if (!hasData) {
    return <div className="card text-center text-sm text-brand-500">No sales data for this selection.</div>;
  }

  return (
    <div className="space-y-5">
      {d?.latest_date && (
        <p className="-mt-2 text-xs text-brand-400">Latest data: {shiftDay(d.latest_date + 'T12:00:00')}</p>
      )}
          <div className="card bg-brand-700 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-200">Net sales · {RANGE_LABEL[range]}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{money(net)}</p>
            <p className="mt-1 text-xs text-gold-200">{checks.toLocaleString()} checks · live Toast data</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Avg check" value={money2(avgCheck)} sub={`${checks.toLocaleString()} checks`} />
            <Kpi label="Projected next week" value={money(projTotal)} sub="forecast" />
            <Kpi
              label="Labor %"
              value={hasLabor ? `${labor.pct}%` : '—'}
              sub={hasLabor ? `${money(labor.cost)} labor cost` : 'syncing punches…'}
              dim={!hasLabor}
            />
            <Kpi
              label="Sales / labor hr"
              value={hasLabor ? money2(labor.splh) : '—'}
              sub={hasLabor ? `${labor.hours.toLocaleString()} hrs worked` : 'syncing punches…'}
              dim={!hasLabor}
            />
          </div>

          {trendBars.length > 0 && (
            <Section title="Sales trend" meta={trendMeta}>
              <BarChart bars={trendBars} max={trendMax} showEvery={trendEvery} />
            </Section>
          )}

          {hasLabor && (
            <Section title="Labor" meta={RANGE_LABEL[range]}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className={`text-2xl font-bold tabular-nums ${labor.pct <= 30 ? 'text-brand-900' : 'text-brick-600'}`}>{labor.pct}%</p>
                  <p className="mt-0.5 text-xs text-brand-500">of sales</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-brand-900">{money2(labor.splh)}</p>
                  <p className="mt-0.5 text-xs text-brand-500">per labor hr</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums text-brand-900">{labor.hours.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-brand-500">hours</p>
                </div>
              </div>
              <p className="mt-3 border-t border-brand-100 pt-3 text-xs text-brand-500">
                {money(labor.cost)} labor cost · target under 30% ·{' '}
                <span className={labor.pct <= 30 ? 'font-semibold text-green-700' : 'font-semibold text-brick-600'}>
                  {labor.pct <= 30 ? 'on target' : 'running high'}
                </span>
              </p>
              {showLaborTrend && (
                <div className="mt-4">
                  <p className="mb-1 text-xs text-brand-400">Labor % by day</p>
                  <BarChart bars={laborBars} max={laborTrendMax} showEvery={range === 'month' ? 5 : 1} format={pct1} formatAxis={pct0} />
                </div>
              )}
            </Section>
          )}

          <Section title="Breakfast vs lunch" meta={RANGE_LABEL[range]}>
            <div className="flex h-9 overflow-hidden rounded-lg border border-brand-100 shadow-sm">
              <div className="flex items-center justify-center bg-gradient-to-b from-gold-300 to-gold-400 text-xs font-bold text-brand-900" style={{ width: `${bPct}%` }}>
                {bPct}%
              </div>
              <div className="flex items-center justify-center bg-gradient-to-b from-brick-400 to-brick-500 text-xs font-bold text-white" style={{ width: `${100 - bPct}%` }}>
                {100 - bPct}%
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-brand-600">
              <span>Breakfast · {money(breakfast)}</span>
              <span>Lunch · {money(lunch)}</span>
            </div>
          </Section>

          {peakDow.dow >= 0 && peakDow.net > 0 && (
            <Section title="By day of week" meta="avg/day, last 8 wks">
              <BarChart bars={dowBars} max={dowMax} />
            </Section>
          )}

          {multi && (
            <Section title="Store leaderboard" meta={RANGE_LABEL[range]}>
              <ul className="space-y-3">
                {board.map((b, i) => (
                  <li key={b.name} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold text-brand-400">{i + 1}</span>
                    <span className="w-24 shrink-0 text-sm font-medium text-brand-900">{b.name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                      <span className="block h-full rounded-full bg-gradient-to-r from-gold-300 to-brand-600" style={{ width: `${(b.net / boardMax) * 100}%` }} />
                    </span>
                    <span className="w-14 text-right text-sm font-bold tabular-nums text-brand-900">{moneyShort(b.net)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Top sellers" meta={RANGE_LABEL[range]}>
            {topSellers.length === 0 ? (
              <p className="text-sm text-brand-500">
                Item-level sales are still syncing from Toast for this selection — check back shortly.
              </p>
            ) : (
              <ul className="space-y-3">
                {topSellers.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold text-brand-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-brand-900">{t.name}</span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-brand-100">
                        <span className="block h-full rounded-full bg-gradient-to-r from-gold-300 to-brand-600" style={{ width: `${(t.net / topMax) * 100}%` }} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold tabular-nums text-brand-900">{moneyShort(t.net)}</span>
                      <span className="block text-xs tabular-nums text-brand-400">{t.units.toLocaleString()} sold</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {actions.length > 0 && (
            <Section title="What to act on">
              <ul className="space-y-2.5">
                {actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-brand-800">
                    <span className="text-gold-500">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Forecast — per-location day-of-week breakdown */}
          {forecast.length > 0 && (
            <Section title="Forecast · next week" meta={`${money(projTotal)} projected`}>
              {store ? (
                (() => {
                  const f = forecast[0];
                  if (!f) return null;
                  const { bars, max, peak } = toDowBars(f.days);
                  return (
                    <>
                      <p className="mb-2 text-xs text-brand-500">
                        Busiest day projected: <span className="font-semibold text-brand-800">{DAY_NAMES[peak]}</span>
                      </p>
                      <BarChart bars={bars} max={max} />
                    </>
                  );
                })()
              ) : (
                <ul className="space-y-4">
                  {forecast.map((f) => {
                    const { bars, max, peak } = toDowBars(f.days);
                    return (
                      <li key={f.id}>
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <span className="text-sm font-medium text-brand-900">{nameById.get(f.id) ?? '—'}</span>
                          <span className="text-xs text-brand-500">
                            {moneyShort(f.proj)}/wk · busiest <span className="font-semibold text-brand-700">{DOW_ABBR[peak]}</span>
                          </span>
                        </div>
                        <Sparkline bars={bars} max={max} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          )}

          <p className="px-1 text-center text-xs text-brand-400">
            Live from Toast. Labor % and sales-per-labor-hour connect as the schedule and pay data come online.
          </p>
    </div>
  );
}
