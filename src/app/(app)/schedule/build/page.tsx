import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { Location, Employee } from '@/lib/database.types';
import { BuilderControls } from './builder-controls';
import { DayEditor } from './day-editor';

export const dynamic = 'force-dynamic';

type WeekShift = {
  id: string;
  roster_employee_id: string | null;
  employee: string | null;
  role: string | null;
  wage: number | null;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  status: string;
  day: string;
};
type Grid = { grid: { dow: number; reco: number }[] };

export default async function BuildSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const store = sp.store && sp.store !== 'all' ? sp.store : null;
  const monday =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? format(startOfWeek(parseISO(sp.week), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const supabase = await createClient();
  const { data: locs } = await supabase.from('locations').select('id, name').eq('is_active', true);
  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];

  const weekStart = parseISO(monday);
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d')}`;

  if (!store) {
    return (
      <div className="space-y-5">
        <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
          <ArrowLeft size={16} /> Back to schedule
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Build schedule</h1>
          <p className="text-sm text-brand-600">Create the week&apos;s shifts, staffed to demand.</p>
        </div>
        <div className="card">
          <BuilderControls locations={locations} store={null} monday={monday} weekLabel={weekLabel} draftCount={0} />
        </div>
        <div className="card text-center text-sm text-brand-500">Pick a store to start building the schedule.</div>
      </div>
    );
  }

  const [{ data: emps }, { data: weekData }, { data: recoData }] = await Promise.all([
    supabase.from('employees').select('*').eq('active', true).eq('location_id', store).order('first_name'),
    supabase.rpc('week_shifts', { p_location: store, p_monday: monday }),
    supabase.rpc('staffing_reco', { p_location: store, p_target: 75 }),
  ]);

  const roster = ((emps ?? []) as Employee[]).map((e) => ({
    id: e.id,
    label: `${e.first_name} ${e.last_name ?? ''}`.trim(),
    role: e.role_title,
    roles: e.role_titles?.length ? e.role_titles : e.role_title ? [e.role_title] : [],
  }));
  const shifts = (weekData ?? []) as WeekShift[];
  const reco = (recoData ?? { grid: [] }) as Grid;

  // Recommended labor hours per day-of-week = sum of hourly recommended staff.
  const recoByDow = new Map<number, number>();
  for (const g of reco.grid) recoByDow.set(g.dow, (recoByDow.get(g.dow) ?? 0) + g.reco);

  const draftCount = shifts.filter((s) => s.status === 'draft').length;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const iso = format(d, 'yyyy-MM-dd');
    return {
      date: iso,
      weekday: format(d, 'EEEE'),
      dayLabel: format(d, 'MMM d'),
      dow: d.getDay(),
      shifts: shifts.filter((s) => s.day === iso),
    };
  });
  const weekDates = days.map((d) => ({ date: d.date, label: `${d.weekday.slice(0, 3)} ${d.dayLabel}` }));

  const shiftHrs = (s: WeekShift) =>
    Math.max(0, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000 - (s.break_minutes || 0) / 60);
  const overview = days.map((d) => {
    const sched = d.shifts.reduce((n, s) => n + shiftHrs(s), 0);
    const reco = recoByDow.get(d.dow) ?? 0;
    const gap = reco - sched;
    const tone = reco <= 0 ? 'bg-brand-50 text-brand-400' : gap > 4 ? 'bg-brick-500/10 text-brick-600' : gap < -4 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
    return { key: d.date, abbr: d.weekday.slice(0, 3), count: d.shifts.length, sched, reco, tone };
  });

  return (
    <div className="space-y-4">
      <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to schedule
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Build schedule</h1>
        <p className="text-sm text-brand-600">{locations.find((l) => l.id === store)?.name} · staffed to demand</p>
      </div>

      <div className="card">
        <BuilderControls locations={locations} store={store} monday={monday} weekLabel={weekLabel} draftCount={draftCount} />
      </div>

      {/* Week-at-a-glance: scheduled vs recommended hours per day. */}
      <section>
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 className="font-semibold text-brand-900">Week at a glance</h2>
          <span className="text-[11px] text-brand-500">scheduled / recommended hrs</span>
        </div>
        <div className="-mx-1 grid grid-cols-7 gap-1 px-1">
          {overview.map((o) => (
            <a key={o.key} href={`#day-${o.key}`} className={`rounded-lg p-1.5 text-center ${o.tone}`} title={`${o.abbr}: ${o.sched.toFixed(0)}h scheduled vs ${o.reco > 0 ? o.reco.toFixed(0) + 'h recommended' : 'no recommendation'} · ${o.count} shifts`}>
              <p className="text-[10px] font-bold uppercase">{o.abbr}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{o.sched.toFixed(0)}</p>
              <p className="text-[9px] font-medium tabular-nums opacity-80">of {o.reco > 0 ? o.reco.toFixed(0) : '—'}h</p>
              <p className="mt-0.5 text-[9px] opacity-70">{o.count} shift{o.count === 1 ? '' : 's'}</p>
            </a>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-brand-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-green-100 ring-1 ring-green-300" /> On target</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-brick-500/10 ring-1 ring-brick-400" /> Understaffed (add hours)</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded bg-amber-100 ring-1 ring-amber-400" /> Overstaffed (trim)</span>
        </div>
      </section>

      {days.map((d) => (
        <DayEditor
          key={d.date}
          date={d.date}
          weekday={d.weekday}
          dayLabel={d.dayLabel}
          store={store}
          roster={roster}
          shifts={d.shifts}
          recoHours={recoByDow.get(d.dow) ?? 0}
          weekDates={weekDates}
        />
      ))}
    </div>
  );
}
