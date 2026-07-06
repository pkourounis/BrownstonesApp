import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { shiftDay, shiftTimeRange } from '@/lib/format';
import { CalendarDays, Clock, Users, Inbox, ArrowRight } from 'lucide-react';
import type { Shift } from '@/lib/database.types';

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // Upcoming shifts for the current user (RLS ensures they only see theirs).
  const { data: myShifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('employee_id', profile.id)
    .gte('ends_at', nowIso)
    .order('starts_at', { ascending: true })
    .limit(3);

  // Manager-only stats.
  let pendingTimeOff = 0;
  let teamCount = 0;
  if (canManage(profile.role)) {
    const { count: toCount } = await supabase
      .from('time_off_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    pendingTimeOff = toCount ?? 0;

    const { count: staffCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .neq('id', profile.id);
    teamCount = staffCount ?? 0;
  }

  const firstName = (profile.display_name || profile.full_name || 'there').split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Hi, {firstName} 👋</h1>
        <p className="text-sm text-brand-600">Here&apos;s what&apos;s coming up.</p>
      </div>

      {canManage(profile.role) && (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/schedule" className="card flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Inbox size={20} />
            </span>
            <div>
              <p className="text-xl font-bold text-brand-900">{pendingTimeOff}</p>
              <p className="text-xs text-brand-500">Pending requests</p>
            </div>
          </Link>
          <Link href="/team" className="card flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Users size={20} />
            </span>
            <div>
              <p className="text-xl font-bold text-brand-900">{teamCount}</p>
              <p className="text-xs text-brand-500">Team members</p>
            </div>
          </Link>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Your next shifts</h2>
          <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
            Full schedule <ArrowRight size={14} />
          </Link>
        </div>

        {myShifts && myShifts.length > 0 ? (
          <ul className="space-y-3">
            {(myShifts as Shift[]).map((s) => (
              <li key={s.id} className="card flex items-center gap-4">
                <div className="flex flex-col items-center rounded-xl bg-brand-700 px-3 py-2 text-white">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-brand-900">{shiftDay(s.starts_at)}</p>
                  <p className="flex items-center gap-1 text-sm text-brand-600">
                    <Clock size={14} /> {shiftTimeRange(s.starts_at, s.ends_at)}
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
        ) : (
          <div className="card text-center text-sm text-brand-500">
            No upcoming shifts scheduled yet.
          </div>
        )}
      </section>
    </div>
  );
}
