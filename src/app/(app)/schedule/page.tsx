import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { shiftTimeRange, shiftHours, money } from '@/lib/format';
import { format, parseISO, startOfToday, startOfWeek, addDays } from 'date-fns';
import { CalendarPlus, Clock, User, Gauge, ClipboardCheck, Hand, CalendarX2 } from 'lucide-react';
import Link from 'next/link';
import { TimeOffButton } from './time-off-button';
import { OfferShift, ClaimShift } from './shift-actions';
import { MyRequests, type MyReq } from './my-requests';
import { ViewControls } from './view-controls';
import { ScheduleExport, type ExportRow } from './schedule-export';

export const dynamic = 'force-dynamic';

type ShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  status: 'draft' | 'published';
  notes: string | null;
  employee_id: string | null;
  roster_employee_id: string | null;
  position: { name: string; color: string } | null;
  employee: { id: string; full_name: string; display_name: string | null } | null;
  roster: { first_name: string; last_name: string | null; role_title: string | null; default_wage: number | null } | null;
};

type SwapRow = {
  id: string;
  shift_id: string;
  requested_by: string;
  requested_to: string | null;
  note: string | null;
  by: { display_name: string | null; full_name: string | null } | null;
  shift: { starts_at: string; ends_at: string } | null;
};

const who = (p: { display_name: string | null; full_name: string | null } | null) => p?.display_name || p?.full_name || 'A teammate';

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const manager = canManage(profile.role);
  const supabase = await createClient();
  const sp = await searchParams;

  const view = sp.view === 'week' || sp.view === 'weekend' ? sp.view : 'list';
  const weekMode = view !== 'list';

  // Range + which days to render.
  let rangeStart: Date;
  let rangeEnd: Date;
  let weekMonday = '';
  let weekLabel = '';
  let weekDayList: Date[] = [];
  if (weekMode) {
    const base = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? parseISO(sp.week) : new Date();
    const monday = startOfWeek(base, { weekStartsOn: 1 });
    rangeStart = monday;
    rangeEnd = addDays(monday, 7);
    weekMonday = format(monday, 'yyyy-MM-dd');
    weekLabel = `${format(monday, 'MMM d')} – ${format(addDays(monday, 6), 'MMM d')}`;
    const all7 = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    // Weekend = Friday, Saturday, Sunday (busiest days).
    weekDayList = view === 'weekend' ? all7.filter((d) => d.getDay() === 5 || d.getDay() === 6 || d.getDay() === 0) : all7;
  } else {
    rangeStart = startOfToday();
    rangeEnd = addDays(rangeStart, 14);
  }

  const today = new Date().toISOString().slice(0, 10);
  const [{ data, error }, { data: myEmps }, { data: swapData }, { data: myReqData }, { data: blackoutData }] = await Promise.all([
    supabase
      .from('shifts')
      .select(
        `id, starts_at, ends_at, break_minutes, status, notes, employee_id, roster_employee_id,
         position:positions(name, color),
         employee:profiles!shifts_employee_id_fkey(id, full_name, display_name),
         roster:employees!shifts_roster_employee_id_fkey(first_name, last_name, role_title, default_wage)`
      )
      .gte('starts_at', rangeStart.toISOString())
      .lt('starts_at', rangeEnd.toISOString())
      .order('starts_at', { ascending: true }),
    supabase.from('employees').select('id').eq('profile_id', profile.id),
    supabase
      .from('shift_swap_requests')
      .select('id, shift_id, requested_by, requested_to, note, by:profiles!shift_swap_requests_requested_by_fkey(display_name, full_name), shift:shifts(starts_at, ends_at)')
      .eq('status', 'pending'),
    supabase.from('time_off_requests').select('id, start_date, end_date, reason, status').eq('profile_id', profile.id).gte('end_date', today).order('start_date'),
    supabase.from('time_off_blackouts').select('start_date, end_date, reason').gte('end_date', today).order('start_date').limit(10),
  ]);

  const shifts = (data as unknown as ShiftRow[]) ?? [];
  const myEmpIds = new Set((myEmps ?? []).map((e) => e.id));
  const swaps = (swapData as unknown as SwapRow[]) ?? [];
  const myRequests = (myReqData as MyReq[]) ?? [];
  const blackouts = (blackoutData as { start_date: string; end_date: string; reason: string | null }[]) ?? [];
  const bdate = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d + 'T12:00:00'));

  const mineShift = (s: ShiftRow) => s.employee_id === profile.id || (!!s.roster_employee_id && myEmpIds.has(s.roster_employee_id));
  const offerByShift = new Map<string, string>(); // shift_id -> my offer id
  for (const w of swaps) if (w.requested_by === profile.id && w.requested_to === null) offerByShift.set(w.shift_id, w.id);
  // Open drops from teammates I could claim.
  const openDrops = swaps.filter((w) => w.requested_to === null && w.requested_by !== profile.id);

  // Group by calendar day.
  const byDay = new Map<string, ShiftRow[]>();
  for (const s of shifts) {
    const key = format(parseISO(s.starts_at), 'yyyy-MM-dd');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(s);
  }

  const costOf = (s: ShiftRow) => shiftHours(s.starts_at, s.ends_at, s.break_minutes) * (Number(s.roster?.default_wage) || 0);
  const dayCost = (list: ShiftRow[]) => list.reduce((n, s) => n + costOf(s), 0);
  const whoName = (s: ShiftRow) =>
    s.employee ? s.employee.display_name || s.employee.full_name : s.roster ? `${s.roster.first_name} ${s.roster.last_name ?? ''}`.trim() : 'Open shift';

  const visibleShifts = weekMode ? weekDayList.flatMap((d) => byDay.get(format(d, 'yyyy-MM-dd')) ?? []) : shifts;
  const exportRows: ExportRow[] = manager
    ? visibleShifts.map((s) => ({
        date: format(parseISO(s.starts_at), 'EEE MMM d'),
        time: shiftTimeRange(s.starts_at, s.ends_at),
        hours: shiftHours(s.starts_at, s.ends_at, s.break_minutes).toFixed(1),
        who: whoName(s),
        role: s.position?.name ?? s.roster?.role_title ?? '',
        cost: costOf(s) > 0 ? money(costOf(s)) : '',
      }))
    : [];
  const exportTitle = weekMode ? weekLabel : 'next 2 weeks';

  const shiftCard = (s: ShiftRow) => {
    const mine = mineShift(s);
    const future = new Date(s.starts_at).getTime() > Date.now();
    return (
      <li key={s.id} className="card py-3">
        <div className="flex items-center gap-3">
          <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: s.position?.color ?? '#a86f4e' }} />
          <div className="flex-1">
            <p className="flex items-center gap-1.5 font-semibold text-brand-900">
              <Clock size={14} className="text-brand-400" />
              {shiftTimeRange(s.starts_at, s.ends_at)}
              <span className="text-xs font-normal text-brand-400">· {shiftHours(s.starts_at, s.ends_at, s.break_minutes).toFixed(1)}h</span>
            </p>
            <p className="flex items-center gap-1.5 text-sm text-brand-600">
              <User size={13} className="text-brand-400" />
              {s.employee
                ? s.employee.display_name || s.employee.full_name
                : s.roster
                  ? `${s.roster.first_name} ${s.roster.last_name ?? ''}`.trim()
                  : 'Open shift'}
              {mine && <span className="text-brand-400">· you</span>}
              {(s.position?.name || s.roster?.role_title) && <span className="text-brand-400">· {s.position?.name ?? s.roster?.role_title}</span>}
            </p>
          </div>
          {s.status === 'draft' ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Draft</span>
          ) : mine && future ? (
            <OfferShift shiftId={s.id} offerId={offerByShift.get(s.id) ?? null} />
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Schedule</h1>
          <p className="text-sm text-brand-600">{manager ? 'Your location' : 'Your shifts'}</p>
        </div>
        {manager && (
          <Link href="/schedule/build" className="btn-primary">
            <CalendarPlus size={18} /> Build
          </Link>
        )}
      </div>

      <div className="no-print space-y-2">
        <ViewControls view={view} weekLabel={weekLabel} monday={weekMonday} />
        {manager && <ScheduleExport rows={exportRows} title={exportTitle} />}
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <TimeOffButton />
        {manager && (
          <>
            <Link href="/schedule/staffing" className="btn-secondary h-9 flex-1 justify-center text-xs">
              <Gauge size={14} /> Staffing needs
            </Link>
            <Link href="/schedule/actuals" className="btn-secondary h-9 flex-1 justify-center text-xs">
              <ClipboardCheck size={14} /> Scheduled vs actual
            </Link>
          </>
        )}
      </div>

      {/* Blocked days */}
      {blackouts.length > 0 && (
        <div className="no-print card border-l-4 border-l-brick-400 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-900"><CalendarX2 size={15} /> Blocked for time off</p>
          <p className="mt-1 text-xs text-brand-600">
            {blackouts.map((b) => `${bdate(b.start_date)}${b.end_date !== b.start_date ? `–${bdate(b.end_date)}` : ''}${b.reason ? ` (${b.reason})` : ''}`).join(' · ')}
          </p>
        </div>
      )}

      {/* My time-off requests */}
      <div className="no-print">
        <MyRequests requests={myRequests} />
      </div>

      {/* Open shifts up for grabs */}
      {openDrops.length > 0 && (
        <section className="no-print">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><Hand size={18} /> Open shifts up for grabs</h2>
          <ul className="space-y-2">
            {openDrops.map((w) => (
              <li key={w.id} className="card flex items-center gap-3 border-l-4 border-l-amber-400 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-900">{w.shift ? shiftTimeRange(w.shift.starts_at, w.shift.ends_at) : 'Shift'}</p>
                  <p className="text-xs text-brand-500">
                    {w.shift ? format(parseISO(w.shift.starts_at), 'EEE, MMM d') : ''} · from {who(w.by)}{w.note ? ` · “${w.note}”` : ''}
                  </p>
                </div>
                <ClaimShift swapId={w.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <div className="card text-sm text-red-700">Couldn&apos;t load shifts: {error.message}</div>}

      {weekMode && manager && (() => {
        const weekShifts = weekDayList.flatMap((d) => byDay.get(format(d, 'yyyy-MM-dd')) ?? []);
        const wHrs = weekShifts.reduce((n, s) => n + shiftHours(s.starts_at, s.ends_at, s.break_minutes), 0);
        const wCost = dayCost(weekShifts);
        return (
          <div className="card flex items-center justify-between py-3">
            <span className="text-sm font-semibold text-brand-900">{view === 'weekend' ? 'Weekend' : 'Week'} labor</span>
            <span className="text-sm tabular-nums text-brand-700">{wHrs.toFixed(1)}h{wCost > 0 ? ` · ${money(wCost)}` : ''}</span>
          </div>
        );
      })()}

      {weekMode ? (
        <div className="space-y-5">
          {weekDayList.map((d) => {
            const key = format(d, 'yyyy-MM-dd');
            const dayShifts = byDay.get(key) ?? [];
            const hrs = dayShifts.reduce((n, s) => n + shiftHours(s.starts_at, s.ends_at, s.break_minutes), 0);
            const cost = dayCost(dayShifts);
            return (
              <section key={key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-brand-500">{format(d, 'EEEE, MMM d')}</h2>
                  {dayShifts.length > 0 && (
                    <span className="text-xs text-brand-400">
                      {dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'} · {hrs.toFixed(1)}h{manager && cost > 0 ? ` · ${money(cost)}` : ''}
                    </span>
                  )}
                </div>
                {dayShifts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-brand-200 py-3 text-center text-xs text-brand-400">No shifts</div>
                ) : (
                  <ul className="space-y-2">{dayShifts.map(shiftCard)}</ul>
                )}
              </section>
            );
          })}
        </div>
      ) : byDay.size === 0 ? (
        <div className="card text-center text-sm text-brand-500">
          {manager ? 'No shifts scheduled. Tap Build to create the schedule.' : 'No shifts scheduled for you yet.'}
        </div>
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([day, dayShifts]) => {
            const cost = dayCost(dayShifts);
            return (
              <section key={day}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-brand-500">
                    {format(parseISO(day + 'T00:00:00'), 'EEEE, MMM d')}
                  </h2>
                  {manager && cost > 0 && <span className="text-xs tabular-nums text-brand-400">{money(cost)}</span>}
                </div>
                <ul className="space-y-2">{dayShifts.map(shiftCard)}</ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
