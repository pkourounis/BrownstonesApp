import { requireRole } from '@/lib/auth';
import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default async function BuildSchedulePage() {
  await requireRole('super_admin', 'manager');

  return (
    <div className="space-y-5">
      <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to schedule
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Build schedule</h1>
        <p className="text-sm text-brand-600">
          Create the week&apos;s shifts and let AI optimize coverage.
        </p>
      </div>

      <div className="card space-y-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Sparkles size={22} />
        </span>
        <h2 className="font-semibold text-brand-900">AI schedule optimization — coming next</h2>
        <p className="text-sm text-brand-600">
          This is where you&apos;ll set coverage targets per day, and the optimizer
          builds a draft schedule from staff availability, requested days off, and
          expected demand — weighting your strongest team onto the busiest shifts.
          You review, adjust, then publish, which pushes notifications to everyone
          scheduled.
        </p>
        <p className="text-sm text-brand-600">
          The foundation it needs — availability, time-off, positions, shifts, and
          the permission model — is already built and enforced in the database.
        </p>
      </div>
    </div>
  );
}
