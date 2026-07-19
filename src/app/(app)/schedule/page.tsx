import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { shiftTimeRange, shiftHours, money } from '@/lib/format';
import { format, parseISO, startOfToday, startOfWeek, addDays } from 'date-fns';
import { CalendarPlus, Clock, User, Gauge, ClipboardCheck, Hand, CalendarX2, Repeat2 } from 'lucide-react';
import Link from 'next/link';
import { TimeOffButton } from './time-off-button';
import { OfferShift, ClaimShift, ProposeSwap, SwapResponse } from './shift-actions';
import { MyRequests, type MyReq } from './my-requests';
import { ViewControls } from './view-controls';
import { ScheduleExport, type ExportRow } from './schedule-export';
import { StoreSelect } from './store-select';
import { PrintScheduleGrid, type PrintRow } from './print-schedule';
import { WeekStrip, type StripDay } from './week-strip';
import type { Location } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

type ShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  status: 'draft' | 'published';
  notes: string | null;
  role_title: string | null;
  employee_id: string | null;
  roster_employee_id: string | null;
  position: { name: string; color: string } | null;
  employee: { id: string; full_name: string; display_name: string | null } | null;
  roster: { first_name: string; last_name: string | null; role_title: string | null; default_wage: number | null } | null;
};

type SwapRow = {
  id: string;
  shift_id: string;
  target_shift_id: string | null;
  coworker_accepted: boolean;
  requested_by: string;
  requested_to: string | null;
  note: string | null;
  by: { display_name: string | null; full_name: string | null } | null;
  shift: { starts_at: string; ends_at: string } | null;
  target: { starts_at: string; ends_at: string } | null;
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
  const isSuper = profile.role === 'super_admin';

  // Which store's schedule are we viewing? Super admins pick any store; managers
  // see their own; employees aren't store-filtered (they see their own shifts).
  const { data: locData } = manager
    ? await supabase.from('locations').select('id, name, labor_target_splh').eq('is_active', true).order('name')
    : { data: [] };
  const allLocs = (locData ?? []) as Pick<Location, 'id' | 'name' | 'labor_target_splh'>[];
  const selectable = isSuper ? allLocs : allLocs.filter((l) => l.id === profile.primary_location_id);
  const selectedStore = manager
    ? (sp.store && selectable.some((l) => l.id === sp.store) ? sp.store : selectable[0]?.id ?? profile.primary_location_id ?? null)
    : null;
  const storeName = selectable.find((l) => l.id === selectedStore)?.name ?? null;

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
  let shiftQuery = supabase
    .from('shifts')
    .select(
      `id, starts_at, ends_at, break_minutes, status, notes, role_title, employee_id, roster_employee_id,
       position:positions(name, color),
       employee:profiles!shifts_employee_id_fkey(id, full_name, display_name),
       roster:employees!shifts_roster_employee_id_fkey(first_name, last_name, role_title, default_wage)`
    )
    .gte('starts_at', rangeStart.toISOString())
    .lt('starts_at', rangeEnd.toISOString())
    .order('starts_at', { ascending: true });
  if (selectedStore) shiftQuery = shiftQuery.eq('location_id', selectedStore);

  const [{ data, error }, { data: myEmps }, { data: swapData }, { data: myReqData }, { data: blackoutData }] = await Promise.all([
    shiftQuery,
    supabase.from('employees').select('id').eq('profile_id', profile.id),
    supabase
      .from('shift_swap_requests')
      .select('id, shift_id, target_shift_id, coworker_accepted, requested_by, requested_to, note, by:profiles!shift_swap_requests_requested_by_fkey(display_name, full_name), shift:shifts!shift_swap_requests_shift_id_fkey(starts_at, ends_at), target:shifts!shift_swap_requests_target_shift_id_fkey(starts_at, ends_at)')
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

  // My own shift time windows — used to flag open shifts I can't take (overlap).
  const myIntervals = shifts
    .filter(mineShift)
    .map((s) => [new Date(s.starts_at).getTime(), new Date(s.ends_at).getTime()] as const);
  const claimConflict = (w: (typeof openDrops)[number]) => {
    if (!w.shift) return false;
    const a = new Date(w.shift.starts_at).getTime();
    const b = new Date(w.shift.ends_at).getTime();
    return myIntervals.some(([s, e]) => a < e && s < b); // any overlap, full or partial
  };

  // Employees don't see unassigned "open shift" rows — only real assignments.
  const displayShifts = manager ? shifts : shifts.filter((s) => s.employee_id !== null || s.roster_employee_id !== null);

  // Coworkers' upcoming shifts I could propose a 1:1 trade for.
  const swapCandidates = shifts
    .filter((s) => s.employee_id && s.employee_id !== profile.id && s.status === 'published' && new Date(s.starts_at).getTime() > Date.now())
    .map((s) => ({ id: s.id, label: `${s.employee?.display_name || s.employee?.full_name || 'Coworker'} · ${format(parseISO(s.starts_at), 'EEE MMM d')} · ${shiftTimeRange(s.starts_at, s.ends_at)}` }));

  // 1:1 swap proposals waiting on my yes/no.
  const incomingSwaps = swaps.filter((w) => w.requested_to === profile.id && !!w.target_shift_id && !w.coworker_accepted);

  // Group by calendar day.
  const byDay = new Map<string, ShiftRow[]>();
  for (const s of displayShifts) {
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

  // Print layout: a landscape employees × days grid for one week.
  const printMonday = weekMode ? parseISO(weekMonday) : startOfWeek(new Date(), { weekStartsOn: 1 });
  const printDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(printMonday, i);
    return { key: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE M/d') };
  });
  const printLabel = `${format(printMonday, 'MMM d')} – ${format(addDays(printMonday, 6), 'MMM d')}`;
  let printRows: PrintRow[] = [];
  if (manager) {
    let pq = supabase
      .from('shifts')
      .select('id, starts_at, ends_at, employee_id, roster_employee_id, employee:profiles!shifts_employee_id_fkey(full_name, display_name), roster:employees!shifts_roster_employee_id_fkey(first_name, last_name, role_title)')
      .gte('starts_at', printMonday.toISOString())
      .lt('starts_at', addDays(printMonday, 7).toISOString())
      .order('starts_at', { ascending: true });
    if (selectedStore) pq = pq.eq('location_id', selectedStore);
    const { data: pShifts } = await pq;
    type PS = { id: string; starts_at: string; ends_at: string; employee_id: string | null; roster_employee_id: string | null; employee: { full_name: string; display_name: string | null } | null; roster: { first_name: string; last_name: string | null; role_title: string | null } | null };
    const map = new Map<string, PrintRow>();
    for (const s of (pShifts as unknown as PS[]) ?? []) {
      const nm = s.employee ? s.employee.display_name || s.employee.full_name : s.roster ? `${s.roster.first_name} ${s.roster.last_name ?? ''}`.trim() : 'Open shift';
      const key = s.roster_employee_id ?? s.employee_id ?? nm;
      if (!map.has(key)) map.set(key, { name: nm, role: s.roster?.role_title ?? null, cells: {} });
      const dayKey = format(parseISO(s.starts_at), 'yyyy-MM-dd');
      (map.get(key)!.cells[dayKey] ??= []).push(shiftTimeRange(s.starts_at, s.ends_at));
    }
    printRows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Coverage strip for the displayed week (managers, week/weekend views).
  let weekStrip: StripDay[] = [];
  if (weekMode && manager && selectedStore) {
    const target = Number(allLocs.find((l) => l.id === selectedStore)?.labor_target_splh) || 130;
    const { data: recoData } = await supabase.rpc('staffing_reco', { p_location: selectedStore, p_target: target });
    const grid = ((recoData as { grid?: { dow: number; reco: number }[] })?.grid ?? []);
    const recoByDow = new Map<number, number>();
    for (const g of grid) recoByDow.set(g.dow, (recoByDow.get(g.dow) ?? 0) + g.reco);
    weekStrip = weekDayList.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const list = byDay.get(key) ?? [];
      return {
        key,
        abbr: format(d, 'EEE'),
        sched: list.reduce((n, s) => n + shiftHours(s.starts_at, s.ends_at, s.break_minutes), 0),
        reco: recoByDow.get(d.getDay()) ?? 0,
        count: list.length,
      };
    });
  }

  const shiftCard = (s: ShiftRow) => {
    const mine = mineShift(s);
    const future = new Date(s.starts_at).getTime() > Date.now();
    return (
      <li key={s.id} className="card py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: s.position?.color ?? '#a86f4e' }} />
          <div className="min-w-0 flex-1">
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
              {(s.role_title || s.position?.name || s.roster?.role_title) && <span className="text-brand-400">· {s.role_title ?? s.position?.name ?? s.roster?.role_title}</span>}
            </p>
          </div>
          {s.status === 'draft' ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Draft</span>
          ) : mine && future ? (
            <div className="flex shrink-0 items-center gap-3">
              <OfferShift shiftId={s.id} offerId={offerByShift.get(s.id) ?? null} />
              {!offerByShift.get(s.id) && swapCandidates.length > 0 && <ProposeSwap myShiftId={s.id} candidates={swapCandidates} />}
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <>
      {manager && <PrintScheduleGrid storeName={storeName} weekLabel={printLabel} days={printDays} rows={printRows} />}
      <div className="space-y-5 print:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Schedule</h1>
          <p className="text-sm text-brand-600">{manager ? (storeName ?? 'Your location') : 'Your shifts'}</p>
        </div>
        {manager && (
          <Link href={`/schedule/build${selectedStore ? `?store=${selectedStore}` : ''}`} className="btn-primary">
            <CalendarPlus size={18} /> Build
          </Link>
        )}
      </div>

      <div className="no-print space-y-2">
        {isSuper && selectable.length > 1 && selectedStore && <StoreSelect locations={selectable} store={selectedStore} />}
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

      {/* 1:1 swap proposals waiting on me */}
      {incomingSwaps.length > 0 && (
        <section className="no-print">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><Repeat2 size={18} /> Swap requests for you</h2>
          <ul className="space-y-2">
            {incomingSwaps.map((w) => (
              <li key={w.id} className="card flex flex-wrap items-center gap-3 border-l-4 border-l-brand-400 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-900">{who(w.by)} wants to trade shifts</p>
                  <p className="text-xs text-brand-600">
                    You&apos;d give: {w.target ? `${format(parseISO(w.target.starts_at), 'EEE MMM d')} · ${shiftTimeRange(w.target.starts_at, w.target.ends_at)}` : 'your shift'}
                  </p>
                  <p className="text-xs text-brand-600">
                    You&apos;d get: {w.shift ? `${format(parseISO(w.shift.starts_at), 'EEE MMM d')} · ${shiftTimeRange(w.shift.starts_at, w.shift.ends_at)}` : 'their shift'}
                  </p>
                  {w.note && <p className="mt-0.5 text-xs text-brand-500">“{w.note}”</p>}
                </div>
                <SwapResponse swapId={w.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Open shifts up for grabs */}
      {openDrops.length > 0 && (
        <section className="no-print">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><Hand size={18} /> Open shifts up for grabs</h2>
          <ul className="space-y-2">
            {openDrops.map((w) => {
              const conflict = claimConflict(w);
              return (
                <li key={w.id} className="card flex flex-wrap items-center gap-3 border-l-4 border-l-amber-400 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-brand-900">{w.shift ? shiftTimeRange(w.shift.starts_at, w.shift.ends_at) : 'Shift'}</p>
                    <p className="text-xs text-brand-500">
                      {w.shift ? format(parseISO(w.shift.starts_at), 'EEE, MMM d') : ''} · from {who(w.by)}{w.note ? ` · “${w.note}”` : ''}
                    </p>
                    {conflict ? (
                      <p className="mt-1 text-xs font-medium text-brick-600">You already work during this time — you can&apos;t pick this up.</p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-green-700">You&apos;re free then — you can pick this up.</p>
                    )}
                  </div>
                  <ClaimShift swapId={w.id} conflict={conflict} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {error && <div className="card text-sm text-red-700">Couldn&apos;t load shifts: {error.message}</div>}

      {weekStrip.length > 0 && <WeekStrip days={weekStrip} title="Coverage this week" />}

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
    </>
  );
}
