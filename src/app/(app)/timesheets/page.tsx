import { Suspense } from 'react';
import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';
import type { Location } from '@/lib/database.types';
import { TimesheetFilter } from './timesheet-filter';

export const dynamic = 'force-dynamic';

type Row = {
  location_id: string;
  employee: string | null;
  job: string | null;
  tipped: boolean;
  in_at: string | null;
  out_at: string | null;
  hours: number;
  ot_hours: number;
  wage: number;
  cost: number;
  open: boolean;
};
type Sheet = { date: string; rows: Row[] };

const fmtTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
    : '—';

const fmtDay = (d: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(d + 'T12:00:00'));

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <p className="text-xl font-bold tabular-nums text-brand-900">{value}</p>
      <p className="mt-0.5 text-xs text-brand-500">{label}</p>
    </div>
  );
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const store = sp.store && sp.store !== 'all' ? sp.store : null;
  const validDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;

  const supabase = await createClient();
  const [{ data: locs }, { data: latest }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('is_active', true),
    validDate
      ? Promise.resolve({ data: null })
      : supabase.from('toast_time_entries').select('business_date').order('business_date', { ascending: false }).limit(1),
  ]);
  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const date = validDate ?? (latest?.[0]?.business_date as string | undefined) ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Timesheets</h1>
        <p className="text-sm text-brand-600">Punch in / out · {fmtDay(date)}</p>
      </div>

      <TimesheetFilter locations={locations} date={date} />

      <Suspense key={`${date}:${store ?? 'all'}`} fallback={<div className="card h-64 animate-pulse bg-brand-50" />}>
        <SheetView date={date} store={store} locations={locations} />
      </Suspense>
    </div>
  );
}

async function SheetView({
  date,
  store,
  locations,
}: {
  date: string;
  store: string | null;
  locations: Pick<Location, 'id' | 'name'>[];
}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('timesheet', { p_date: date, p_location: store });
  const sheet = (data ?? { date, rows: [] }) as Sheet;
  const rows = sheet.rows ?? [];
  const nameById = new Map(locations.map((l) => [l.id, l.name]));

  if (rows.length === 0) {
    return <div className="card text-center text-sm text-brand-500">No punches recorded for this day.</div>;
  }

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const list = groups.get(r.location_id) ?? [];
    list.push(r);
    groups.set(r.location_id, list);
  }

  const totalHours = rows.reduce((s, r) => s + Number(r.hours), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.cost), 0);
  const openCount = rows.filter((r) => r.open).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Tile label={openCount ? `on shift · ${openCount} now` : 'shifts'} value={`${rows.length}`} />
        <Tile label="hours" value={totalHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} />
        <Tile label="labor cost" value={money(totalCost)} />
      </div>

      {[...groups.entries()].map(([locId, rs]) => {
        const gHours = rs.reduce((s, r) => s + Number(r.hours), 0);
        const gCost = rs.reduce((s, r) => s + Number(r.cost), 0);
        return (
          <section key={locId} className="card">
            <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-brand-100 pb-2">
              <h2 className="font-semibold text-brand-900">{nameById.get(locId) ?? 'Store'}</h2>
              <span className="text-xs text-brand-500">
                {rs.length} · {gHours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs · {money(gCost)}
              </span>
            </div>
            <ul className="divide-y divide-brand-50">
              {rs.map((r, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-900">
                      {r.employee ?? 'Unknown'}
                      {r.open && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                          <Clock size={10} /> on now
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-brand-500">
                      {r.job ?? '—'}
                      {r.tipped ? ' · tipped' : ''}
                      {Number(r.ot_hours) > 0 ? ` · ${Number(r.ot_hours)}h OT` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums text-brand-800">
                      {fmtTime(r.in_at)} – {r.open ? '···' : fmtTime(r.out_at)}
                    </p>
                    <p className="text-xs tabular-nums text-brand-500">
                      {Number(r.hours).toLocaleString(undefined, { maximumFractionDigits: 2 })} hrs
                      {Number(r.wage) > 0 ? ` · ${money(Number(r.cost))}` : ' · salary'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="px-1 text-center text-xs text-brand-400">
        Live punch data from Toast. Salaried staff show no hourly cost, so labor cost is a floor.
      </p>
    </div>
  );
}
