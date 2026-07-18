'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, Trash2, Archive, ArchiveRestore, KeyRound, Loader2, Check, Copy, UserCheck } from 'lucide-react';
import type { Employee, Location, Department } from '@/lib/database.types';
import { JOB_ROLES } from '@/lib/job-roles';
import { updateEmployee, setEmployeeRating, deleteEmployee, grantAccess } from '../actions';

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
}: {
  member: Employee;
  locations: Pick<Location, 'id' | 'name'>[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [accessMsg, setAccessMsg] = useState<string | null>(null);

  const onGrant = () => {
    setAccessMsg(null);
    setTemp(null);
    startTransition(async () => {
      const res = await grantAccess(member.id);
      if (!res.ok) return setAccessMsg(res.error ?? 'Could not grant access.');
      if (res.linked) setAccessMsg('Linked to their existing app account.');
      else if (res.tempPassword) setTemp(res.tempPassword);
      router.refresh();
    });
  };

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
  const [roleTitles, setRoleTitles] = useState<string[]>(member.role_titles ?? []);
  const [active, setActive] = useState(member.active);
  const extras = (member.role_titles ?? []).filter((r) => !JOB_ROLES.includes(r));
  const roles = [...JOB_ROLES, ...(member.role_title && !JOB_ROLES.includes(member.role_title) ? [member.role_title] : []), ...extras.filter((r) => r !== member.role_title)];
  const allRoles = [...new Set(roles)];

  const toggleRole = (r: string) =>
    setRoleTitles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const onSave = () => {
    setMsg(null);
    startTransition(async () => {
      // Keep the primary role in the multi-role set.
      const titles = [...new Set([...(f.role_title ? [f.role_title] : []), ...roleTitles])];
      const res = await updateEmployee(member.id, {
        first_name: f.first_name,
        last_name: f.last_name || null,
        email: f.email || null,
        phone: f.phone || null,
        role_title: f.role_title || null,
        role_titles: titles,
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
            <label className="label">Primary role</label>
            <select className="input" value={f.role_title} onChange={(e) => setF({ ...f, role_title: e.target.value })}>
              <option value="">—</option>
              {allRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Roles they can work</label>
          <div className="flex flex-wrap gap-1.5">
            {allRoles.map((r) => {
              const on = r === f.role_title || roleTitles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => r !== f.role_title && toggleRole(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${on ? 'bg-brand-700 text-white' : 'bg-white text-brand-600 ring-1 ring-brand-200'} ${r === f.role_title ? 'opacity-90' : ''}`}
                >
                  {r}{r === f.role_title ? ' ★' : ''}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-brand-500">Tap every role this person can work (e.g. server + host). ★ is their primary. Used when scheduling so they can be a server one day and a host another.</p>
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
        {member.profile_id ? (
          <Link href={`/team/${member.profile_id}`} className="btn-secondary w-full justify-center">
            <KeyRound size={16} /> Manage app access
          </Link>
        ) : temp ? (
          <div className="rounded-lg border border-gold-400 bg-gold-100 p-3">
            <p className="text-sm font-medium text-brand-900">App access granted</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-sm text-brand-900">{temp}</code>
              <button type="button" onClick={() => navigator.clipboard?.writeText(temp)} className="btn-secondary h-8 px-2 text-xs">
                <Copy size={14} /> Copy
              </button>
            </div>
            <p className="mt-2 text-xs text-brand-600">
              Give them this temporary password, or they can sign in with the &ldquo;email me a link&rdquo; option using {member.email || 'their email'}.
            </p>
          </div>
        ) : (
          <button onClick={onGrant} disabled={pending} className="btn-secondary w-full justify-center">
            <UserCheck size={16} /> Give app access
          </button>
        )}
        {accessMsg && <p className="text-xs text-brand-600">{accessMsg}</p>}

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
