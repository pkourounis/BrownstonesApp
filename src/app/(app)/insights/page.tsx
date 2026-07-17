import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { money, hourLabel, monthAbbr } from '@/lib/format';
import { shiftDay } from '@/lib/format';
import type {
  Location,
  ReportSalesTotals,
  ReportSalesByHour,
  ReportSalesMonthly,
  ReportForecastWeekly,
} from '@/lib/database.types';

export const dynamic = 'force-dynamic';

type Bar = { label: string; value: number; peak: boolean };

/** Server-rendered bar chart (no client JS). Peak bar in brick, rest in gold. */
function BarChart({ bars, max }: { bars: Bar[]; max: number }) {
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5">
        {bars.map((b, i) => (
          <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] font-semibold tabular-nums text-brick-600 opacity-0 transition group-hover:opacity-100">
              {money(b.value)}
            </span>
            <div
              className={`w-full max-w-[30px] rounded-t-md ${b.peak ? 'bg-brick-500' : 'bg-gold-400'}`}
              style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }}
              title={money(b.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 text-center text-[10px] tabular-nums text-brand-400">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const [locsRes, totalsRes, hoursRes, monthlyRes, fcRes] = await Promise.all([
    supabase.from('locations').select('id, name').eq('is_active', true),
    supabase.from('report_sales_totals').select('*'),
    supabase.from('report_sales_by_hour').select('*'),
    supabase.from('report_sales_monthly').select('*'),
    supabase.from('report_forecast_weekly').select('*'),
  ]);

  const locations = (locsRes.data ?? []) as Pick<Location, 'id' | 'name'>[];
  const totals = (totalsRes.data ?? []) as ReportSalesTotals[];
  const byHour = (hoursRes.data ?? []) as ReportSalesByHour[];
  const monthly = (monthlyRes.data ?? []) as ReportSalesMonthly[];
  const forecasts = (fcRes.data ?? []) as ReportForecastWeekly[];

  const nameById = new Map(locations.map((l) => [l.id, l.name]));

  // Company aggregates (whatever RLS returned for this user).
  const ytdNet = totals.reduce((s, t) => s + Number(t.ytd_net ?? 0), 0);
  const latestNet = totals.reduce((s, t) => s + Number(t.latest_net ?? 0), 0);
  const projected = forecasts.reduce((s, f) => s + Number(f.projected_week ?? 0), 0);
  const latestDate = totals.find((t) => t.latest_date)?.latest_date ?? null;

  // Sales by hour (aggregate across visible locations).
  const hourMap = new Map<number, number>();
  byHour.forEach((r) => hourMap.set(r.hour, (hourMap.get(r.hour) ?? 0) + Number(r.revenue ?? 0)));
  const hourEntries = [...hourMap.entries()].map(([hour, rev]) => ({ hour, rev })).sort((a, b) => a.hour - b.hour);
  const hourMax = Math.max(1, ...hourEntries.map((h) => h.rev));
  const peakHour = hourEntries.reduce((a, h) => (h.rev > a.rev ? h : a), hourEntries[0] ?? { hour: -1, rev: 0 });
  const hourBars: Bar[] = hourEntries.map((h) => ({ label: hourLabel(h.hour), value: h.rev, peak: h.hour === peakHour.hour }));

  // Monthly (last 12).
  const monMap = new Map<string, number>();
  monthly.forEach((r) => monMap.set(r.ym, (monMap.get(r.ym) ?? 0) + Number(r.net ?? 0)));
  const monEntries = [...monMap.entries()]
    .map(([ym, net]) => ({ ym, net }))
    .sort((a, b) => a.ym.localeCompare(b.ym))
    .slice(-12);
  const monMax = Math.max(1, ...monEntries.map((m) => m.net));
  const peakMonth = monEntries.reduce((a, m) => (m.net > a.net ? m : a), monEntries[0] ?? { ym: '', net: 0 });
  const monBars: Bar[] = monEntries.map((m) => ({ label: monthAbbr(m.ym), value: m.net, peak: m.ym === peakMonth.ym }));

  // Store leaderboard (only meaningful with >1 location in view).
  const board = totals
    .map((t) => ({ name: nameById.get(t.location_id) ?? '—', net: Number(t.ytd_net ?? 0), proj: 0 }))
    .sort((a, b) => b.net - a.net);
  const fcById = new Map(forecasts.map((f) => [f.location_id, Number(f.projected_week ?? 0)]));
  totals.forEach((t) => {
    const row = board.find((b) => b.name === (nameById.get(t.location_id) ?? '—'));
    if (row) row.proj = fcById.get(t.location_id) ?? 0;
  });
  const boardMax = Math.max(1, ...board.map((b) => b.net));
  const multi = board.length > 1;

  const hasData = totals.length > 0 && ytdNet > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Insights</h1>
        <p className="text-sm text-brand-600">
          {hasData && latestDate
            ? `Live sales from Toast · latest ${shiftDay(latestDate + 'T12:00:00')}`
            : 'Sales insights'}
        </p>
      </div>

      {!hasData ? (
        <div className="card text-center text-sm text-brand-500">
          No sales data is visible for your account yet.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card col-span-2 bg-brand-700 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-200">Net sales · last 12 months</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{money(ytdNet)}</p>
              <p className="mt-1 text-xs text-gold-200">
                {board.length} location{board.length === 1 ? '' : 's'} · from live Toast data
              </p>
            </div>
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">Latest day</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-brand-900">{money(latestNet)}</p>
              <p className="mt-0.5 text-xs text-brand-500">
                {latestDate ? shiftDay(latestDate + 'T12:00:00') : ''}
              </p>
            </div>
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">Projected next week</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-brand-900">{money(projected)}</p>
              <p className="mt-0.5 text-xs text-brand-500">forecast from 12-mo history</p>
            </div>
          </div>

          {/* Sales by hour */}
          {hourBars.length > 0 && (
            <section className="card">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold text-brand-900">Sales by hour</h2>
                <span className="text-xs text-brand-400">
                  {peakHour.hour >= 0 ? `peak ${hourLabel(peakHour.hour)} · ${money(peakHour.rev)}` : ''}
                </span>
              </div>
              <BarChart bars={hourBars} max={hourMax} />
            </section>
          )}

          {/* Monthly */}
          {monBars.length > 0 && (
            <section className="card">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold text-brand-900">Monthly sales</h2>
                <span className="text-xs text-brand-400">
                  busiest {monthAbbr(peakMonth.ym)} · {money(peakMonth.net)}
                </span>
              </div>
              <BarChart bars={monBars} max={monMax} />
            </section>
          )}

          {/* Leaderboard */}
          {multi && (
            <section className="card">
              <h2 className="mb-3 font-semibold text-brand-900">Store leaderboard</h2>
              <ul className="space-y-3">
                {board.map((b, i) => (
                  <li key={b.name} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-bold text-brand-400">{i + 1}</span>
                    <span className="w-24 shrink-0 text-sm font-medium text-brand-900">{b.name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-100">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-gold-400 to-brand-600"
                        style={{ width: `${(b.net / boardMax) * 100}%` }}
                      />
                    </span>
                    <span className="w-16 text-right text-sm font-bold tabular-nums text-brand-900">
                      {money(b.net)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-brand-400">Ranked by trailing 12-month net sales.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
