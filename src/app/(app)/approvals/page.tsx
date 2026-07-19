import { CalendarOff, CalendarClock, Repeat2, Inbox } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { Location } from '@/lib/database.types';
import { Decide } from './decide';
import { BlackoutManager, type Blackout } from './blackout-manager';

export const dynamic = 'force-dynamic';

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmtDate = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d + 'T12:00:00'));
const fmtTime = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const hhmm = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${am ? 'am' : 'pm'}`;
};
const who = (p: { display_name: string | null; full_name: string | null } | null) => p?.display_name || p?.full_name || 'Someone';

export default async function ApprovalsPage() {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const isSuper = me.role === 'super_admin';

  const [{ data: timeOff }, { data: avail }, { data: swaps }, { data: blackoutData }, { data: locData }] = await Promise.all([
    supabase
      .from('time_off_requests')
      .select('id, start_date, end_date, reason, created_at, profile:profiles!time_off_requests_profile_id_fkey(display_name, full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('availability')
      .select('id, day_of_week, start_time, end_time, is_available, created_at, profile:profiles!availability_profile_id_fkey(display_name, full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('shift_swap_requests')
      .select(`id, note, created_at, requested_to,
        by:profiles!shift_swap_requests_requested_by_fkey(display_name, full_name),
        to:profiles!shift_swap_requests_requested_to_fkey(display_name, full_name),
        shift:shifts(starts_at, ends_at)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase.from('time_off_blackouts').select('id, location_id, start_date, end_date, reason').gte('end_date', new Date().toISOString().slice(0, 10)).order('start_date'),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
  ]);

  const blackouts = (blackoutData as Blackout[]) ?? [];
  const allLocs = (locData ?? []) as Pick<Location, 'id' | 'name'>[];
  // Managers can only block their own store; super admins any store.
  const manageableLocs = isSuper ? allLocs : allLocs.filter((l) => l.id === me.primary_location_id);

  type TO = { id: string; start_date: string; end_date: string; reason: string | null; profile: { display_name: string | null; full_name: string | null } | null };
  type AV = { id: string; day_of_week: number; start_time: string; end_time: string; is_available: boolean; profile: { display_name: string | null; full_name: string | null } | null };
  type SW = { id: string; note: string | null; requested_to: string | null; by: { display_name: string | null; full_name: string | null } | null; to: { display_name: string | null; full_name: string | null } | null; shift: { starts_at: string; ends_at: string } | null };

  const to = (timeOff as unknown as TO[]) ?? [];
  const av = (avail as unknown as AV[]) ?? [];
  const sw = (swaps as unknown as SW[]) ?? [];
  const total = to.length + av.length + sw.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Approvals</h1>
        <p className="text-sm text-brand-600">{total === 0 ? 'Nothing waiting on you.' : `${total} request${total === 1 ? '' : 's'} to review`}</p>
      </div>

      {total === 0 && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center text-sm text-brand-500">
          <Inbox size={28} className="text-brand-300" /> You&apos;re all caught up.
        </div>
      )}

      {sw.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><Repeat2 size={18} /> Shift drops &amp; swaps</h2>
          <ul className="space-y-2">
            {sw.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-900">
                    {who(s.by)} {s.requested_to ? <>→ <span className="text-brand-700">{who(s.to)}</span></> : <span className="text-brand-500">· up for grabs</span>}
                  </p>
                  <p className="text-xs text-brand-500">{s.shift ? `${fmtTime(s.shift.starts_at)}–${fmtTime(s.shift.ends_at).split(' ').pop()}` : 'Shift'}{s.note ? ` · “${s.note}”` : ''}</p>
                  {!s.requested_to && <p className="mt-0.5 text-[11px] text-amber-700">No one has claimed this yet — approving releases it as an open shift.</p>}
                </div>
                <Decide id={s.id} kind="swap" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {to.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><CalendarOff size={18} /> Time off</h2>
          <ul className="space-y-2">
            {to.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-900">{who(r.profile)}</p>
                  <p className="text-xs text-brand-500">
                    {fmtDate(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmtDate(r.end_date)}` : ''}{r.reason ? ` · ${r.reason}` : ''}
                  </p>
                </div>
                <Decide id={r.id} kind="timeoff" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {av.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><CalendarClock size={18} /> Availability changes</h2>
          <ul className="space-y-2">
            {av.map((a) => (
              <li key={a.id} className="card flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-900">{who(a.profile)}</p>
                  <p className="text-xs text-brand-500">
                    {DAY[a.day_of_week]} · {a.is_available ? `available ${hhmm(a.start_time)}–${hhmm(a.end_time)}` : `unavailable ${hhmm(a.start_time)}–${hhmm(a.end_time)}`}
                  </p>
                </div>
                <Decide id={a.id} kind="availability" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <BlackoutManager blackouts={blackouts} locations={manageableLocs} />
    </div>
  );
}
