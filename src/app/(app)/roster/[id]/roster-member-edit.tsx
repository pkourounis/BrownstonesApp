'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, Trash2, Archive, ArchiveRestore, KeyRound, Loader2, Check } from 'lucide-react';
import type { Employee, Location, Department } from '@/lib/database.types';
import { JOB_ROLES } from '@/lib/job-roles';
import { updateEmployee, setEmployeeRating, deleteEmployee } from '../actions';

const DEPARTMENTS: [Department, string][] = [
  ['foh', 'Front of House'],
  ['boh', 'Back of House'],
  ['management', 'Management'],
];

function Stars({ value, onSet, busy }: { value: number; onSet: (n: number) => void; busy: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={busy} onMouseEnter={() => setHover(n)} onClick={() => onSet(value === n ? 0 : n)} className="p-0.5" aria-label={`${n} stars`}>
          <Star size={26} className={(hover || value) >= n ? 'fill-gold-400 text-gold-500' : 'text-brand-200'} />
        </button>
      ))}
      {value > 0 && <span className="ml-1 text-sm font-semibold tabular-nums text-brand-700">{value}.0</span>}
    </div>
  );
}

export function RosterMemberEdit({
  member,
  locations,
  linkedProfileId,
}: {
  member: Employee;
  locations: Pick<Location, 'id' | 'name'>[];
  linkedProfileId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const [f, setF] = useState({
    first_name: member.first_name ?? '',
    last_name: member.last_name ?? '',
    email: member.email ?? '',
    phone: member.phone ?? '',
    role_title: member.role_title ?? '',
    department: (member.department ?? '') as Department | '',
    location_id: member.location_id,
    default_wage: member.default_wage != null ? String(member.default_wage) : '',
  });
  const [active, setActive] = useState(member.active);
  const roles = member.role_title && !JOB_ROLES.includes(member.role_title) ? [...JOB_ROLES, member.role_title] : JOB_ROLES;

  const onSave = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateEmployee(member.id, {
        first_name: f.first_name,
        last_name: f.last_name || null,
        email: f.email || null,
        phone: f.phone || null,
        role_title: f.role_title || null,
        department: (f.department || null) as Department | null,
        location_id: f.location_id,
        default_wage: f.default_wage ? Number(f.default_wage) : null,
      });
      setMsg(res.ok ? 'Saved.' : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });
  };

  const onRate = (n: number) =>
    startTransition(async () => {
      await setEmployeeRating(member.id, n);
      router.refresh();
    });

  const onArchive = () =>
    startTransition(async () => {
      const res = await updateEmployee(member.id, { active: !active });
      if (res.ok) {
        setActive(!active);
        router.refresh();
      } else setMsg(res.error ?? 'Error');
    });

  const onDelete = () =>
    startTransition(async () => {
      const res = await deleteEmployee(member.id);
      if (res.ok) router.push('/roster');
      else setMsg(res.error ?? 'Error');
    });

  return (
    <div className="space-y-4">
      {/* Star ranking */}
      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Star ranking</h2>
          <span className="text-xs text-brand-400">managers &amp; admins</span>
        </div>
        <Stars value={member.rating ?? 0} onSet={onRate} busy={pending} />
      </div>

      {/* Details */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Department</label>
            <select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value as Department | '' })}>
              <option value="">—</option>
              {DEPARTMENTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Job role</label>
            <select className="input" value={f.role_title} onChange={(e) => setF({ ...f, role_title: e.target.value })}>
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Location</label>
            <select className="input" value={f.location_id} onChange={(e) => setF({ ...f, location_id: e.target.value })}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Wage $/hr</label>
            <input type="number" step="0.25" min="0" className="input" value={f.default_wage} onChange={(e) => setF({ ...f, default_wage: e.target.value })} />
          </div>
        </div>
        <button onClick={onSave} disabled={pending} className="btn-primary w-full">
          {pending ? <Loader2 className="animate-spin" size={18} /> : 'Save changes'}
        </button>
      </div>

      {/* Access + lifecycle */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-brand-900">Access &amp; status</h2>
        {linkedProfileId ? (
          <Link href={`/team/${linkedProfileId}`} className="btn-secondary w-full justify-center">
            <KeyRound size={16} /> Manage app access
          </Link>
        ) : (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-500">
            No app login linked. This person is on the roster (scheduling &amp; labor) but can&apos;t sign in. Invite them from the
            Team page to give access.
          </p>
        )}

        <button
          onClick={onArchive}
          disabled={pending}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
            active ? 'bg-brick-500/10 text-brick-600' : 'bg-green-100 text-green-700'
          }`}
        >
          {active ? <Archive size={16} /> : <ArchiveRestore size={16} />}
          {active ? 'Archive (remove from scheduling)' : 'Restore to active'}
        </button>

        {confirmDel ? (
          <div className="flex gap-2">
            <button onClick={onDelete} disabled={pending} className="flex-1 rounded-xl bg-brick-600 px-3 py-2.5 text-sm font-semibold text-white">
              {pending ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button onClick={() => setConfirmDel(false)} className="btn-secondary px-3">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} className="flex w-full items-center justify-center gap-2 text-sm font-medium text-brand-400 hover:text-brick-600">
            <Trash2 size={15} /> Delete permanently
          </button>
        )}
      </div>

      {msg && (
        <p className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <Check size={15} /> {msg}
        </p>
      )}
    </div>
  );
}
