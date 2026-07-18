import Link from 'next/link';
import { ArrowLeft, CalendarClock, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { Meeting, MeetingType } from '@/lib/database.types';
import { RequestMeeting, MeetingActions } from './meeting-tools';
import { MEETING_TYPES } from './constants';

export const dynamic = 'force-dynamic';

type Row = Meeting & { employee: { first_name: string; last_name: string | null } | null };

const TYPE_LABEL: Record<MeetingType, string> = Object.fromEntries(MEETING_TYPES.map((t) => [t.key, t.label])) as Record<MeetingType, string>;
const TYPE_CLS: Record<MeetingType, string> = {
  review: 'bg-brand-100 text-brand-700',
  disciplinary: 'bg-brick-500/15 text-brick-600',
  training: 'bg-blue-100 text-blue-700',
  discussion: 'bg-green-100 text-green-700',
  other: 'bg-brand-100 text-brand-600',
};
const name = (e: { first_name: string; last_name: string | null } | null) => (e ? `${e.first_name} ${e.last_name ?? ''}`.trim() : 'Employee');
const fmtDT = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : 'No time set';

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const preset = (await searchParams).new;

  const [{ data: mtgData }, { data: emps }] = await Promise.all([
    supabase.from('meetings').select('*, employee:employees!meetings_employee_id_fkey(first_name, last_name)').order('scheduled_at', { ascending: true }),
    supabase.from('employees').select('id, first_name, last_name').eq('active', true).order('first_name'),
  ]);

  const meetings = (mtgData as unknown as Row[]) ?? [];
  const upcoming = meetings.filter((m) => m.status === 'scheduled');
  const done = meetings.filter((m) => m.status === 'completed').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 25);
  const people = (emps ?? []).map((e) => ({ id: e.id, name: `${e.first_name} ${e.last_name ?? ''}`.trim() }));

  const Item = ({ m, open }: { m: Row; open: boolean }) => (
    <li className="card flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-brand-900">{name(m.employee)}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_CLS[m.type]}`}>{TYPE_LABEL[m.type]}</span>
        </div>
        <p className="text-xs text-brand-500">
          {m.status === 'completed' ? `Completed ${m.completed_at ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(m.completed_at)) : ''}` : fmtDT(m.scheduled_at)}
          {m.location ? ` · ${m.location}` : ''}
          {m.status === 'completed' && m.rating ? ` · ${m.rating}★` : ''}
        </p>
        {m.description && m.status !== 'completed' && <p className="mt-0.5 line-clamp-2 text-xs text-brand-600">{m.description}</p>}
        {m.status === 'completed' && m.notes && <p className="mt-0.5 line-clamp-2 text-xs text-brand-600">{m.notes}</p>}
      </div>
      {open && <MeetingActions id={m.id} isReview={m.type === 'review'} />}
    </li>
  );

  return (
    <div className="space-y-6">
      <Link href="/roster" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to roster
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Meetings</h1>
          <p className="text-sm text-brand-600">Reviews, training, discussions &amp; more with your team.</p>
        </div>
        <RequestMeeting people={people} presetEmployee={preset} />
      </div>

      {meetings.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center text-sm text-brand-500">
          <CalendarClock size={26} className="text-brand-300" /> No meetings yet — request one to get started.
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-brand-900">Upcoming</h2>
          <ul className="space-y-2">{upcoming.map((m) => <Item key={m.id} m={m} open />)}</ul>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-brand-900"><Star size={16} className="text-gold-500" /> Completed</h2>
          <ul className="space-y-2">{done.map((m) => <Item key={m.id} m={m} open={false} />)}</ul>
        </section>
      )}
    </div>
  );
}
