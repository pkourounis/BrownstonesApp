'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Star, KeyRound, Archive, ArchiveRestore, Check, Loader2, Copy } from 'lucide-react';
import type { Profile, Location, AppRole, Department, EmploymentStatus } from '@/lib/database.types';
import { setRating, setArchived, updateMember, resetPassword } from '../actions';

const DEPARTMENTS: [Department, string][] = [
  ['foh', 'Front of House'],
  ['boh', 'Back of House'],
  ['management', 'Management'],
];
const STATUSES: [EmploymentStatus, string][] = [
  ['onboarding', 'Onboarding'],
  ['active', 'Active'],
  ['inactive', 'Archived'],
];
const ROLES: [AppRole, string][] = [
  ['employee', 'Employee'],
  ['manager', 'Manager'],
  ['super_admin', 'Super Admin'],
];

function Stars({ value, onSet, busy }: { value: number; onSet: (n: number) => void; busy: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onClick={() => onSet(value === n ? 0 : n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="p-0.5"
          >
            <Star size={26} className={on ? 'fill-gold-400 text-gold-500' : 'text-brand-200'} />
          </button>
        );
      })}
      {value > 0 && <span className="ml-1 text-sm font-semibold tabular-nums text-brand-700">{value}.0</span>}
    </div>
  );
}

export function MemberAdmin({
  member,
  rating,
  locations,
  callerRole,
}: {
  member: Profile;
  rating: number;
  locations: Pick<Location, 'id' | 'name'>[];
  callerRole: AppRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);

  const [role, setRole] = useState<AppRole>(member.role);
  const [department, setDepartment] = useState<Department | ''>(member.department ?? '');
  const [title, setTitle] = useState(member.title ?? '');
  const [location, setLocation] = useState(member.primary_location_id ?? '');
  const [status, setStatus] = useState<EmploymentStatus>(member.employment_status);
  const archived = status === 'inactive';

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? okMsg : res.error ?? 'Something went wrong.');
      if (res.ok) router.refresh();
    });
  };

  const onRate = (n: number) =>
    startTransition(async () => {
      await setRating(member.id, n);
      router.refresh();
    });

  const onSave = () =>
    run(
      () => updateMember(member.id, { role, department: department || null, title: title || null, primary_location_id: location || null, employment_status: status }),
      'Saved.'
    );

  const onReset = () => {
    setMsg(null);
    setTemp(null);
    startTransition(async () => {
      const res = await resetPassword(member.id);
      if (res.ok && res.tempPassword) {
        setTemp(res.tempPassword);
      } else {
        setMsg(res.error ?? 'Could not reset password.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Star ranking */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Star ranking</h2>
          <span className="text-xs text-brand-400">managers only</span>
        </div>
        <Stars value={rating} onSet={onRate} busy={pending} />
        <p className="mt-2 text-xs text-brand-500">Used to weight your strongest team onto the busiest shifts.</p>
      </div>

      {/* Work details */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Work details</h2>
        {callerRole === 'super_admin' && (
          <div>
            <label className="label">Access role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Department</label>
            <select className="input" value={department} onChange={(e) => setDepartment(e.target.value as Department | '')}>
              <option value="">—</option>
              {DEPARTMENTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Job role</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Barista…" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Location</label>
            <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as EmploymentStatus)}>
              {STATUSES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={onSave} disabled={pending} className="btn-primary w-full">
          {pending ? <Loader2 className="animate-spin" size={18} /> : 'Save details'}
        </button>
      </div>

      {/* Access */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-brand-900">Access</h2>
        {temp ? (
          <div className="rounded-lg border border-gold-400 bg-gold-100 p-3">
            <p className="text-sm font-medium text-brand-900">Temporary password</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-sm text-brand-900">{temp}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(temp)}
                className="btn-secondary h-8 px-2 text-xs"
              >
                <Copy size={14} /> Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-brand-600">
              Give this to {member.first_name || 'them'}. They&apos;ll be asked to change it after signing in.
            </p>
          </div>
        ) : (
          <button onClick={onReset} disabled={pending} className="btn-secondary w-full">
            <KeyRound size={16} /> Reset password
          </button>
        )}

        <button
          onClick={() => run(() => setArchived(member.id, !archived), archived ? 'Restored.' : 'Archived.')}
          disabled={pending}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
            archived ? 'bg-green-100 text-green-700' : 'bg-brick-500/10 text-brick-600'
          }`}
        >
          {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          {archived ? 'Restore member' : 'Archive member'}
        </button>
      </div>

      {msg && (
        <p className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <Check size={15} /> {msg}
        </p>
      )}
    </div>
  );
}
