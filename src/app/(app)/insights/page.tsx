import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { money, money2, moneyShort, hourLabel, monthAbbr, shiftDay, DOW_ABBR } from '@/lib/format';
import type { Location } from '@/lib/database.types';
import { InsightsFilter } from './insights-filter';
import { SyncButton } from './sync-button';

export const dynamic = 'force-dynamic';

type Bar = { label: string; value: number; peak: boolean };

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
  forecast: { id: string; proj: number }[];
};

function BarChart({ bars, max, showEvery = 1 }: { bars: Bar[]; max: number; showEvery?: number }) {
  const ticks = 4;
  return (
    <div className="flex gap-2">
      <div className="relative h-40 w-10 shrink-0">
        {Array.from({ length: ticks + 1 }).map((_, i) => (
          <span
            key={i}
            className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums text-brand-400"
            style={{ top: `${(i / ticks) * 100}%` }}
          >
            {moneyShort((max * (ticks - i)) / ticks)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-40 border-b border-l border-brand-100">
          {Array.from({ length: ticks }).map((_, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-dashed border-brand-100" style={{ top: `${(i / ticks) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[3px] px-1">
            {bars.map((b, i) => (
              <div key={i} className="flex h-full min-w-0 flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-[26px] rounded-t-sm ${b.peak ? 'bg-brick-500' : 'bg-gold-400'}`}
                  style={{ height: `${Math.max(1, (b.value / max) * 100)}%` }}
                  title={`${b.label}: ${money(b.value)}`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex gap-[3px] px-1">
          {bars.map((b, i) => (
            <div key={i} className="min-w-0 flex-1 text-center text-[9px] tabular-nums text-brand-400">
              {i % showEvery === 0 ? b.label : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

const RANGE_LABEL: Record<string, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
  year: 'last 12 months',
};

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const range = ['today', 'week', 'month', 'year'].includes(sp.range ?? '') ? sp.range! : 'year';
  const store = sp.store && sp.store !== 'all' ? sp.store : null;

  const supabase = await createClient();
  const [locsRes, rpcRes] = await Promise.all([
    supabase.from('locations').select('id, name').eq('is_active', true),
    supabase.rpc('insights', { p_range: range, p_location: store }),
  ]);

  const locations = (locsRes.data ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(locations.map((l) => [l.id, l.name]));
  const d = (rpcRes.data ?? null) as InsightsData | null;

  const net = Number(d?.net ?? 0);
  const checks = Number(d?.checks ?? 0);
  const avgCheck = checks > 0 ? net / checks : 0;
  const hasData = net > 0;

  // Trend adapts to the range.
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
      trendBars = rows.map((r) => ({ label: monthAbbr(r.ym), value: r.net, peak: r.ym === peak.ym }));
      trendMeta = 'monthly';
    } else {
      const rows = [...d.daily].sort((a, b) => a.date.localeCompare(b.date));
      trendMax = Math.max(1, ...rows.map((r) => r.net));
      const last = rows[rows.length - 1]?.date;
      trendBars = rows.map((r) => ({ label: `${Number(r.date.slice(8, 10))}`, value: r.net, peak: r.date === last }));
      trendEvery = range === 'month' ? 5 : 1;
      trendMeta = 'daily';
    }
  }

  // Day-of-week
  const dowRows = Array.from({ length: 7 }, (_, i) => ({ dow: i, net: Number(d?.by_dow.find((x) => x.dow === i)?.net ?? 0) }));
  const dowMax = Math.max(1, ...dowRows.map((r) => r.net));
  const peakDow = dowRows.reduce((a, r) => (r.net > a.net ? r : a), { dow: -1, net: 0 });
  const dowBars: Bar[] = dowRows.map((r) => ({ label: DOW_ABBR[r.dow][0], value: r.net, peak: r.dow === peakDow.dow }));

  // Peak hour (for KPI + insight)
  const peakHour = (d?.by_hour ?? []).reduce((a, r) => (r.net > a.net ? r : a), { hour: -1, net: 0 });

  // Daypart
  const breakfast = Number(d?.daypart.breakfast ?? 0);
  const lunch = Number(d?.daypart.lunch ?? 0);
  const dpTot = breakfast + lunch || 1;
  const bPct = Math.round((breakfast / dpTot) * 100);

  // Leaderboard + forecast
  const board = (d?.leaderboard ?? []).map((r) => ({ name: nameById.get(r.id) ?? '—', net: Number(r.net) }));
  const boardMax = Math.max(1, ...board.map((b) => b.net));
  const forecast = (d?.forecast ?? []).map((r) => ({ name: nameById.get(r.id) ?? '—', proj: Number(r.proj) }));
  const projTotal = forecast.reduce((s, f) => s + f.proj, 0);
  const projMax = Math.max(1, ...forecast.map((f) => f.proj));
  const multi = board.length > 1;

  // "What to act on" — generated from the real numbers.
  const actions: string[] = [];
  if (peakDow.dow >= 0) actions.push(`${DOW_ABBR[peakDow.dow]} is the strongest day (${money(peakDow.net)}/day avg) — keep it fully staffed.`);
  if (peakHour.hour >= 0) actions.push(`Demand peaks at ${hourLabel(peakHour.hour)} — schedule your highest-rated team then.`);
  if (dpTot > 1) actions.push(`${bPct >= 50 ? 'Breakfast' : 'Lunch'} drives ${Math.max(bPct, 100 - bPct)}% of sales this ${range === 'today' ? 'day' : 'period'}.`);
  if (forecast.length && !store) actions.push(`Next week, ${forecast[0].name} is projected highest (${money(forecast[0].proj)}).`);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Insights</h1>
          <p className="text-sm text-brand-600">
            {store ? nameById.get(store) ?? 'Store' : 'All stores'} · {RANGE_LABEL[range]}
            {d?.latest_date ? ` · latest ${shiftDay(d.latest_date + 'T12:00:00')}` : ''}
          </p>
        </div>
        <SyncButton />
      </div>

      <InsightsFilter locations={locations} />

      {!hasData ? (
        <div className="card text-center text-sm text-brand-500">No sales data for this selection.</div>
      ) : (
        <>
          {/* Hero */}
          <div className="card bg-brand-700 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-200">Net sales · {RANGE_LABEL[range]}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{money(net)}</p>
            <p className="mt-1 text-xs text-gold-200">{checks.toLocaleString()} checks · live Toast data</p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Avg check" value={money2(avgCheck)} sub={`${checks.toLocaleString()} checks`} />
            <Kpi label="Projected next week" value={money(projTotal)} sub="forecast" />
            <Kpi label="Labor %" value="—" sub="connect schedule + pay" dim />
            <Kpi label="Sales / labor hr" value="—" sub="connect schedule" dim />
          </div>

          {/* Sales trend */}
          {trendBars.length > 0 && (
            <Section title="Sales trend" meta={trendMeta}>
              <BarChart bars={trendBars} max={trendMax} showEvery={trendEvery} />
            </Section>
          )}

          {/* Breakfast vs lunch */}
          <Section title="Breakfast vs lunch" meta={RANGE_LABEL[range]}>
            <div className="flex h-8 overflow-hidden rounded-lg border border-brand-100">
              <div className="flex items-center justify-center bg-gold-400 text-xs font-bold text-brand-900" style={{ width: `${bPct}%` }}>{bPct}%</div>
              <div className="flex items-center justify-center bg-brick-500 text-xs font-bold text-white" style={{ width: `${100 - bPct}%` }}>{100 - bPct}%</div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-brand-600">
              <span>Breakfast · {money(breakfast)}</span>
              <span>Lunch · {money(lunch)}</span>
            </div>
          </Section>

          {/* Busiest day */}
          {peakDow.dow >= 0 && (
            <Section title="By day of week" meta={`busiest ${DOW_ABBR[peakDow.dow]}`}>
              <BarChart bars={dowBars} max={dowMax} />
            </Section>
          )}

          {/* Store leaderboard */}
          {multi && (
            <Section title="Store leaderboard" meta={RANGE_LABEL[range]}>
              <ul className="space-y-3">
                {board.map((b, i) => (
                  <li key={b.name} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold text-brand-400">{i + 1}</span>
                    <span className="w-24 shrink-0 text-sm font-medium text-brand-900">{b.name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                      <span className="block h-full rounded-full bg-gradient-to-r from-gold-400 to-brand-600" style={{ width: `${(b.net / boardMax) * 100}%` }} />
                    </span>
                    <span className="w-14 text-right text-sm font-bold tabular-nums text-brand-900">{moneyShort(b.net)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Top sellers — needs the menu sync */}
          <Section title="Top sellers" meta="coming soon">
            <p className="text-sm text-brand-500">
              Item-level sales connect with the Toast <span className="font-medium">menu sync</span> — then this ranks your best
              items by revenue for the selected store &amp; time.
            </p>
          </Section>

          {/* What to act on */}
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

          {/* Forecast */}
          {forecast.length > 0 && (
            <Section title="Forecast · next week" meta={`${money(projTotal)} total`}>
              <ul className="space-y-3">
                {forecast.map((b) => (
                  <li key={b.name} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm font-medium text-brand-900">{b.name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                      <span className="block h-full rounded-full bg-brick-400" style={{ width: `${(b.proj / projMax) * 100}%` }} />
                    </span>
                    <span className="w-14 text-right text-sm font-bold tabular-nums text-brand-900">{moneyShort(b.proj)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <p className="px-1 text-center text-xs text-brand-400">
            Live from Toast. Labor %, sales-per-labor-hour, and top sellers connect as the schedule, pay, and menu sync come online.
          </p>
        </>
      )}
    </div>
  );
}
