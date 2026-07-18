import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { hourLabel, DOW_ABBR, DAY_NAMES } from '@/lib/format';
import type { Location } from '@/lib/database.types';
import { StaffingControls } from './staffing-controls';

export const dynamic = 'force-dynamic';

// Store-level sales goal per operating hour. Cells at/above this are "on target".
const HOURLY_SALES_GOAL = 1300;

type Reco = {
  target: number;
  stores: { id: string; reco_hours: number; actual_hours: number; gap: number }[];
  grid: { dow: number; hour: number; rev: number; reco: number }[];
};

export default async function BuildSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const store = sp.store && sp.store !== 'all' ? sp.store : null;
  const target = Math.min(150, Math.max(40, Number(sp.target) || 75));

  const supabase = await createClient();
  const [{ data: locs }, { data: recoData }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('is_active', true),
    supabase.rpc('staffing_reco', { p_location: store, p_target: target }),
  ]);
  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(locations.map((l) => [l.id, l.name]));
  const reco = (recoData ?? { target, stores: [], grid: [] }) as Reco;

  // Build the day-of-week × hour grid.
  const hours = [...new Set(reco.grid.map((g) => g.hour))].sort((a, b) => a - b);
  const cell = new Map(reco.grid.map((g) => [`${g.dow}-${g.hour}`, g]));
  const maxReco = Math.max(1, ...reco.grid.map((g) => g.reco));
  const peakStaff = reco.grid.reduce((m, g) => Math.max(m, g.reco), 0);

  // The combined "all stores" grid sums revenue across stores, so scale the
  // per-store $1,300/hr goal by the store count when no single store is picked.
  const storeCount = Math.max(1, locations.length);
  const hourlyGoal = HOURLY_SALES_GOAL * (store ? 1 : storeCount);
  const onTarget = reco.grid.filter((g) => g.rev >= hourlyGoal).length;
  const openHours = reco.grid.length;

  return (
    <div className="space-y-5">
      <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to schedule
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Staffing needs</h1>
        <p className="text-sm text-brand-600">
          Demand-driven head-count from your Toast sales-per-hour. Use it to plan the week.
        </p>
      </div>

      <div className="card">
        <StaffingControls locations={locations} target={target} />
      </div>

      {/* Which stores need staff */}
      {reco.stores.length > 0 && (
        <section className="card">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-brand-900">Where to adjust staff</h2>
            <span className="text-xs text-brand-400">reco vs actual · hrs/week</span>
          </div>
          <ul className="space-y-3">
            {reco.stores.map((s) => {
              const under = s.gap > 8; // needs more people
              const over = s.gap < -8; // running heavy
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-sm font-medium text-brand-900">{nameById.get(s.id) ?? '—'}</span>
                  <span className="flex-1 text-xs text-brand-500">
                    <span className="tabular-nums text-brand-700">{s.reco_hours}</span> reco ·{' '}
                    <span className="tabular-nums text-brand-700">{s.actual_hours}</span> actual
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      under ? 'bg-brick-500/15 text-brick-600' : over ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {under ? `add ~${Math.round(s.gap)}h` : over ? `trim ~${Math.round(-s.gap)}h` : 'on target'}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-brand-100 pt-3 text-xs text-brand-500">
            &ldquo;Reco&rdquo; is the weekly labor hours demand supports at ${reco.target}/labor-hr; &ldquo;actual&rdquo; is what was
            punched (last 8 weeks avg). Positive gap = add people; negative = running heavy.
          </p>
        </section>
      )}

      {/* Coverage heat grid */}
      {hours.length > 0 && (
        <section className="card">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-brand-900">Recommended coverage</h2>
            <span className="text-xs text-brand-400">{store ? nameById.get(store) : 'all stores'} · staff/hr</span>
          </div>
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded" style={{ boxShadow: 'inset 0 0 0 2px #16a34a', backgroundColor: 'rgba(122,84,40,0.4)' }} />
              At/above ${hourlyGoal.toLocaleString()}/hr goal
            </span>
            <span className="font-semibold text-brand-700">
              {onTarget} of {openHours} hours hit goal
            </span>
          </p>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="border-separate" style={{ borderSpacing: '2px' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white" />
                  {hours.map((h) => (
                    <th key={h} className="pb-1 text-[9px] font-medium tabular-nums text-brand-400">
                      {hourLabel(h).replace(':00', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }, (_, dow) => (
                  <tr key={dow}>
                    <td className="sticky left-0 bg-white pr-1 text-right text-[10px] font-semibold text-brand-500">
                      {DOW_ABBR[dow]}
                    </td>
                    {hours.map((h) => {
                      const g = cell.get(`${dow}-${h}`);
                      const n = g?.reco ?? 0;
                      const a = n > 0 ? 0.15 + 0.7 * (n / maxReco) : 0;
                      const hit = !!g && g.rev >= hourlyGoal;
                      return (
                        <td
                          key={h}
                          title={
                            g
                              ? `${DAY_NAMES[dow]} ${hourLabel(h)} — ${n} staff · ~$${Math.round(g.rev).toLocaleString()}/hr (${hit ? 'on' : 'under'} $${hourlyGoal.toLocaleString()} goal)`
                              : ''
                          }
                          className="h-7 w-7 rounded text-center text-[10px] font-bold tabular-nums"
                          style={{
                            backgroundColor: n > 0 ? `rgba(122, 84, 40, ${a})` : '#f4efe6',
                            color: a > 0.5 ? 'white' : '#5b4a34',
                            boxShadow: hit ? 'inset 0 0 0 2px #16a34a' : undefined,
                          }}
                        >
                          {n || ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-brand-500">
            Darker = busier. Green outline = the hour averages at/above the ${hourlyGoal.toLocaleString()}/hr sales goal. Peak demand needs
            about <span className="font-semibold text-brand-700">{peakStaff} on the floor</span>. Pick a store above for its own pattern
            {store ? '' : ' and a per-store goal'}.
          </p>
        </section>
      )}

      <Link href="/schedule/build" className="card flex items-center justify-between gap-3 hover:border-brand-300">
        <div>
          <h2 className="font-semibold text-brand-900">Build the week&apos;s shifts →</h2>
          <p className="mt-1 text-sm text-brand-600">Turn these targets into a real schedule, staffing to demand.</p>
        </div>
        <ArrowLeft size={18} className="shrink-0 rotate-180 text-brand-400" />
      </Link>
    </div>
  );
}
