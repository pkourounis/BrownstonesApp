import { ClipboardList, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { EmployeeReview } from '@/lib/database.types';
import { RequestReview, ReviewActions } from './review-tools';

export const dynamic = 'force-dynamic';

type Row = EmployeeReview & { profile: { display_name: string | null; full_name: string | null } | null };
const who = (p: { display_name: string | null; full_name: string | null } | null) => p?.display_name || p?.full_name || 'Team member';
const fmt = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d + 'T12:00:00'));

export default async function ReviewsPage() {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: reviewData }, { data: profs }] = await Promise.all([
    supabase
      .from('employee_reviews')
      .select('*, profile:profiles!employee_reviews_profile_id_fkey(display_name, full_name)')
      .order('due_date', { ascending: true }),
    supabase.from('profiles').select('id, display_name, full_name, employment_status').neq('employment_status', 'inactive').order('full_name'),
  ]);

  const reviews = (reviewData as unknown as Row[]) ?? [];
  const scheduled = reviews.filter((r) => r.status === 'scheduled');
  const due = scheduled.filter((r) => r.due_date <= today);
  const upcoming = scheduled.filter((r) => r.due_date > today);
  const completed = reviews.filter((r) => r.status === 'completed').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 20);
  const people = (profs ?? []).map((p) => ({ id: p.id, name: who(p) }));

  const Item = ({ r, open }: { r: Row; open: boolean }) => (
    <li className="card flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-900">{who(r.profile)}</p>
        <p className="text-xs text-brand-500">
          {r.status === 'completed' ? `Completed ${r.completed_at ? fmt(r.completed_at.slice(0, 10)) : ''}` : `Due ${fmt(r.due_date)}`}
          {r.status === 'completed' && r.skills_snapshot?.overall ? ` · ${r.skills_snapshot.overall}★` : ''}
        </p>
        {r.status === 'completed' && r.notes && <p className="mt-0.5 line-clamp-2 text-xs text-brand-600">{r.notes}</p>}
      </div>
      {open && <ReviewActions id={r.id} />}
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Reviews</h1>
          <p className="text-sm text-brand-600">6-month check-ins &amp; ratings.</p>
        </div>
        <RequestReview people={people} />
      </div>

      {reviews.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center text-sm text-brand-500">
          <ClipboardList size={26} className="text-brand-300" /> No reviews yet — request one to get started.
        </div>
      )}

      {due.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-brick-600">Due now</h2>
          <ul className="space-y-2">{due.map((r) => <Item key={r.id} r={r} open />)}</ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-brand-900">Upcoming</h2>
          <ul className="space-y-2">{upcoming.map((r) => <Item key={r.id} r={r} open />)}</ul>
        </section>
      )}
      {completed.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 font-semibold text-brand-900"><Star size={16} className="text-gold-500" /> Completed</h2>
          <ul className="space-y-2">{completed.map((r) => <Item key={r.id} r={r} open={false} />)}</ul>
        </section>
      )}
    </div>
  );
}
