import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { shiftTimeRange, shiftHours } from '@/lib/format';
import { format, parseISO, startOfToday, addDays } from 'date-fns';
import { CalendarPlus, Clock, User, Gauge, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';

type ShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  status: 'draft' | 'published';
  notes: string | null;
  position: { name: string; color: string } | null;
  employee: { id: string; full_name: string; display_name: string | null } | null;
  roster: { first_name: string; last_name: string | null; role_title: string | null } | null;
};

export default async function SchedulePage() {
  const profile = await requireProfile();
  const manager = canManage(profile.role);
  const supabase = await createClient();

  const rangeStart = startOfToday();
  const rangeEnd = addDays(rangeStart, 14);

  const { data, error } = await supabase
    .from('shifts')
    .select(
      `id, starts_at, ends_at, break_minutes, status, notes,
       position:positions(name, color),
       employee:profiles!shifts_employee_id_fkey(id, full_name, display_name),
       roster:employees!shifts_roster_employee_id_fkey(first_name, last_name, role_title)`
    )
    .gte('starts_at', rangeStart.toISOString())
    .lt('starts_at', rangeEnd.toISOString())
    .order('starts_at', { ascending: true });

  const shifts = (data as unknown as ShiftRow[]) ?? [];

  // Group by calendar day.
  const byDay = new Map<string, ShiftRow[]>();
  for (const s of shifts) {
    const key = format(parseISO(s.starts_at), 'yyyy-MM-dd');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(s);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Schedule</h1>
          <p className="text-sm text-brand-600">
            {manager ? 'Next two weeks at your location' : 'Your upcoming shifts'}
          </p>
        </div>
        {manager && (
          <Link href="/schedule/build" className="btn-primary">
            <CalendarPlus size={18} /> Build
          </Link>
        )}
      </div>

      {manager && (
        <div className="flex gap-2">
          <Link href="/schedule/staffing" className="btn-secondary flex-1 justify-center text-xs">
            <Gauge size={14} /> Staffing needs
          </Link>
          <Link href="/schedule/actuals" className="btn-secondary flex-1 justify-center text-xs">
            <ClipboardCheck size={14} /> Scheduled vs actual
          </Link>
        </div>
      )}

      {error && (
        <div className="card text-sm text-red-700">Couldn&apos;t load shifts: {error.message}</div>
      )}

      {byDay.size === 0 ? (
        <div className="card text-center text-sm text-brand-500">
          {manager
            ? 'No shifts scheduled. Tap Build to create the schedule.'
            : 'No shifts scheduled for you yet.'}
        </div>
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([day, dayShifts]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-500">
                {format(parseISO(day + 'T00:00:00'), 'EEEE, MMM d')}
              </h2>
              <ul className="space-y-2">
                {dayShifts.map((s) => (
                  <li key={s.id} className="card flex items-center gap-3 py-3">
                    <span
                      className="h-10 w-1.5 rounded-full"
                      style={{ backgroundColor: s.position?.color ?? '#a86f4e' }}
                    />
                    <div className="flex-1">
                      <p className="flex items-center gap-1.5 font-semibold text-brand-900">
                        <Clock size={14} className="text-brand-400" />
                        {shiftTimeRange(s.starts_at, s.ends_at)}
                        <span className="text-xs font-normal text-brand-400">
                          · {shiftHours(s.starts_at, s.ends_at, s.break_minutes).toFixed(1)}h
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5 text-sm text-brand-600">
                        <User size={13} className="text-brand-400" />
                        {s.employee
                          ? s.employee.display_name || s.employee.full_name
                          : s.roster
                            ? `${s.roster.first_name} ${s.roster.last_name ?? ''}`.trim()
                            : 'Open shift'}
                        {(s.position?.name || s.roster?.role_title) && (
                          <span className="text-brand-400">· {s.position?.name ?? s.roster?.role_title}</span>
                        )}
                      </p>
                    </div>
                    {s.status === 'draft' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Draft
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
