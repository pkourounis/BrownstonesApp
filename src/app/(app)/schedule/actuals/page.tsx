import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';
import type { Location } from '@/lib/database.types';
import { ActualsFilter } from './actuals-filter';

export const dynamic = 'force-dynamic';

type Row = {
  name: string;
  sched_hours: number;
  sched_in: string | null;
  sched_out: string | null;
  act_hours: number;
  act_in: string | null;
  act_out: string | null;
  act_cost: number;
  planned: boolean;
  worked: boolean;
};
type Result = {
  date: string;
  source: 'app' | 'sling' | 'none';
  totals: { sched_hours: number; act_hours: number; act_cost: number; noshow: number; unscheduled: number };
  rows: Row[];
};

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '—';

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(d + 'T12:00:00'));

/** Classify a row into a status chip. */
function chip(r: Row): { label: string; cls: string } | null {
  if (r.planned && !r.worked) return { label: 'No-show', cls: 'bg-brick-500/15 text-brick-600' };
  if (!r.planned && r.worked) return { label: 'Unscheduled', cls: 'bg-amber-100 text-amber-700' };
  if (r.sched_in && r.act_in) {
    const lateMin = (new Date(r.act_in).getTime() - new Date(r.sched_in).getTime()) / 60000;
    if (lateMin > 8) return { label: `Late ${Math.round(lateMin)}m`, cls: 'bg-amber-100 text-amber-700' };
  }
  if (r.sched_hours > 0 && r.act_hours < r.sched_hours - 0.5) return { label: 'Short', cls: 'bg-amber-100 text-amber-700' };
  if (r.sched_hours > 0 && r.act_hours > r.sched_hours + 0.5) return { label: 'Over', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'On time', cls: 'bg-green-100 text-green-700' };
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card text-center">
      <p className={`text-xl font-bold tabular-nums ${tone ?? 'text-brand-900'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-brand-500">{label}</p>
    </div>
  );
}

export default async function ActualsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const validDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;

  const supabase = await createClient();
  const { data: locs } = await supabase.from('locations').select('id, name').eq('is_active', true);
  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const store = sp.store && locations.some((l) => l.id === sp.store) ? sp.store! : locations[0]?.id;

  if (!store) {
    return <div className="card text-center text-sm text-brand-500">No stores available.</div>;
  }

  const { data: latest } = validDate
    ? { data: null }
    : await supabase
        .from('toast_time_entries')
        .select('business_date')
        .order('business_date', { ascending: false })
        .limit(1);
  const date = validDate ?? (latest?.[0]?.business_date as string | undefined) ?? new Date().toISOString().slice(0, 10);

  const { data } = await supabase.rpc('schedule_vs_actual', { p_location: store, p_date: date });
  const res = (data ?? { date, source: 'none', totals: { sched_hours: 0, act_hours: 0, act_cost: 0, noshow: 0, unscheduled: 0 }, rows: [] }) as Result;
  const variance = res.totals.act_hours - res.totals.sched_hours;

  return (
    <div className="space-y-4">
      <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to schedule
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Scheduled vs actual</h1>
        <p className="text-sm text-brand-600">Plan against real punches · {fmtDay(date)}</p>
      </div>

      <ActualsFilter locations={locations} store={store} date={date} />

      {res.rows.length === 0 ? (
        <div className="card text-center text-sm text-brand-500">No schedule or punches for this day.</div>
      ) : (
        <>
          <p className="text-xs text-brand-500">
            Comparing punches to{' '}
            <span className="font-semibold text-brand-700">
              {res.source === 'app' ? 'your in-app schedule' : res.source === 'sling' ? 'your Sling schedule' : 'no schedule'}
            </span>
            . Build the week here and it switches to your in-app plan.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <Tile label="scheduled hrs" value={res.totals.sched_hours.toFixed(1)} />
            <Tile label="actual hrs" value={res.totals.act_hours.toFixed(1)} />
            <Tile
              label="variance"
              value={`${variance >= 0 ? '+' : ''}${variance.toFixed(1)}h`}
              tone={Math.abs(variance) <= 4 ? 'text-green-700' : 'text-brick-600'}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="labor cost" value={money(res.totals.act_cost)} />
            <Tile label="no-shows" value={`${res.totals.noshow}`} tone={res.totals.noshow ? 'text-brick-600' : 'text-brand-900'} />
            <Tile label="unscheduled" value={`${res.totals.unscheduled}`} tone={res.totals.unscheduled ? 'text-amber-700' : 'text-brand-900'} />
          </div>

          <section className="card">
            <ul className="divide-y divide-brand-50">
              {res.rows.map((r, i) => {
                const c = chip(r);
                return (
                  <li key={i} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-brand-900">{r.name}</p>
                      <p className="truncate text-xs text-brand-500">
                        {r.planned ? `sched ${fmt(r.sched_in)}–${fmt(r.sched_out)}` : 'not scheduled'}
                        {' · '}
                        {r.worked ? `punched ${fmt(r.act_in)}–${fmt(r.act_out)}` : 'no punch'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs tabular-nums text-brand-500">
                        {r.sched_hours.toFixed(1)} → <span className="font-semibold text-brand-800">{r.act_hours.toFixed(1)}h</span>
                      </p>
                      {c && <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${c.cls}`}>{c.label}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
