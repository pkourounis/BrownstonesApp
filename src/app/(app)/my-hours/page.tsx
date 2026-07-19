import { Clock, CalendarDays } from 'lucide-react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { shiftTimeRange } from '@/lib/format';
import { OfferShift, ProposeSwap } from '../schedule/shift-actions';

export const dynamic = 'force-dynamic';

const hrs = (startIso: string, endIso: string, brk = 0) =>
  Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000 - (brk || 0) / 60);

type Entry = { business_date: string; regular_hours: number | null; overtime_hours: number | null };
type Shift = { id: string; starts_at: string; ends_at: string; break_minutes: number; status: string; role_title: string | null };

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card text-center">
      <p className="text-2xl font-bold tabular-nums text-brand-900">{value}</p>
      <p className="mt-0.5 text-xs text-brand-500">{label}</p>
      {sub && <p className="text-[11px] text-brand-400">{sub}</p>}
    </div>
  );
}

export default async function MyHoursPage() {
  const me = await requireProfile();
  const supabase = await createClient();

  const etToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const weekStart = startOfWeek(parseISO(etToday), { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
  const lastWeekStartStr = format(addDays(weekStart, -7), 'yyyy-MM-dd');
  const sixWeeksAgoStr = format(addDays(weekStart, -42), 'yyyy-MM-dd');

  // My roster rows → Toast guids (for actual punches) + ids (for scheduled shifts).
  const { data: emps } = await supabase.from('employees').select('id, toast_employee_guid').eq('profile_id', me.id);
  const myEmpIds = ((emps ?? []) as { id: string; toast_employee_guid: string | null }[]).map((e) => e.id);
  const myGuids = ((emps ?? []) as { id: string; toast_employee_guid: string | null }[]).map((e) => e.toast_employee_guid).filter(Boolean) as string[];

  // Scheduled shifts: this week + next 3 weeks.
  const orParts = [`employee_id.eq.${me.id}`];
  if (myEmpIds.length) orParts.push(`roster_employee_id.in.(${myEmpIds.join(',')})`);
  const { data: shiftData } = await supabase
    .from('shifts')
    .select('id, starts_at, ends_at, break_minutes, status, role_title')
    .or(orParts.join(','))
    .eq('status', 'published')
    .gte('starts_at', weekStart.toISOString())
    .lt('starts_at', addDays(weekStart, 28).toISOString())
    .order('starts_at');
  const shifts = (shiftData ?? []) as Shift[];

  // For the give-up / swap actions on upcoming shifts.
  const nowIso = new Date().toISOString();
  const [{ data: offerData }, { data: candData }] = await Promise.all([
    supabase.from('shift_swap_requests').select('id, shift_id').eq('requested_by', me.id).eq('status', 'pending').is('requested_to', null),
    me.primary_location_id
      ? supabase
          .from('shifts')
          .select('id, starts_at, ends_at, employee:profiles!shifts_employee_id_fkey(display_name, full_name)')
          .eq('location_id', me.primary_location_id)
          .eq('status', 'published')
          .not('employee_id', 'is', null)
          .neq('employee_id', me.id)
          .gt('starts_at', nowIso)
          .order('starts_at')
      : Promise.resolve({ data: [] }),
  ]);
  const offerByShift = new Map<string, string>();
  for (const o of (offerData ?? []) as { id: string; shift_id: string }[]) offerByShift.set(o.shift_id, o.id);
  const swapCandidates = ((candData ?? []) as unknown as { id: string; starts_at: string; ends_at: string; employee: { display_name: string | null; full_name: string | null } | null }[])
    .map((s) => ({ id: s.id, label: `${s.employee?.display_name || s.employee?.full_name || 'Coworker'} · ${format(parseISO(s.starts_at), 'EEE MMM d')} · ${shiftTimeRange(s.starts_at, s.ends_at)}` }));

  // Actual punched hours (last 6 weeks) from Toast.
  let entries: Entry[] = [];
  if (myGuids.length) {
    const { data: te } = await supabase
      .from('toast_time_entries')
      .select('business_date, regular_hours, overtime_hours')
      .in('employee_guid', myGuids)
      .eq('deleted', false)
      .gte('business_date', sixWeeksAgoStr)
      .order('business_date', { ascending: false });
    entries = (te ?? []) as Entry[];
  }
  const entryHrs = (e: Entry) => (Number(e.regular_hours) || 0) + (Number(e.overtime_hours) || 0);

  const workedThisWeek = entries.filter((e) => e.business_date >= weekStartStr && e.business_date <= weekEndStr).reduce((s, e) => s + entryHrs(e), 0);
  const workedLastWeek = entries.filter((e) => e.business_date >= lastWeekStartStr && e.business_date < weekStartStr).reduce((s, e) => s + entryHrs(e), 0);

  const scheduledThisWeek = shifts
    .filter((s) => { const d = format(new Date(s.starts_at), 'yyyy-MM-dd'); return d >= weekStartStr && d <= weekEndStr; })
    .reduce((s, x) => s + hrs(x.starts_at, x.ends_at, x.break_minutes), 0);

  const now = Date.now();
  const upcoming = shifts.filter((s) => new Date(s.starts_at).getTime() >= now);

  // Group actual hours by week for the history list.
  const byWeek = new Map<string, number>();
  for (const e of entries) {
    const wk = format(startOfWeek(parseISO(e.business_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + entryHrs(e));
  }
  const weeks = [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">My hours</h1>
        <p className="text-sm text-brand-600">What you&apos;ve worked and what&apos;s coming up.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Worked this week" value={`${workedThisWeek.toFixed(1)}h`} sub="clocked in" />
        <Tile label="Scheduled this week" value={`${scheduledThisWeek.toFixed(1)}h`} sub="on the schedule" />
        <Tile label="Last week" value={`${workedLastWeek.toFixed(1)}h`} sub="clocked in" />
      </div>

      {/* Upcoming scheduled shifts */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><CalendarDays size={18} /> Upcoming shifts</h2>
        {upcoming.length === 0 ? (
          <div className="card text-center text-sm text-brand-500">No upcoming shifts scheduled.</div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-700 text-white">
                  <span className="text-[10px] uppercase leading-none">{format(new Date(s.starts_at), 'EEE')}</span>
                  <span className="text-sm font-bold leading-none">{format(new Date(s.starts_at), 'd')}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-900">{format(new Date(s.starts_at), 'EEEE, MMM d')}</p>
                  <p className="text-xs text-brand-500">{shiftTimeRange(s.starts_at, s.ends_at)}{s.role_title ? ` · ${s.role_title}` : ''}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">{hrs(s.starts_at, s.ends_at, s.break_minutes).toFixed(1)}h</span>
                <OfferShift shiftId={s.id} offerId={offerByShift.get(s.id) ?? null} />
                {!offerByShift.get(s.id) && swapCandidates.length > 0 && <ProposeSwap myShiftId={s.id} candidates={swapCandidates} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actual hours history */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><Clock size={18} /> Hours worked (last 6 weeks)</h2>
        {weeks.length === 0 ? (
          <div className="card text-center text-sm text-brand-500">
            No punch history yet. Your clocked hours from Toast will appear here once your account is linked.
          </div>
        ) : (
          <ul className="card divide-y divide-brand-50">
            {weeks.map(([wk, total]) => (
              <li key={wk} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-brand-700">Week of {format(parseISO(wk), 'MMM d')}</span>
                <span className="text-sm font-bold tabular-nums text-brand-900">{total.toFixed(1)}h</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
