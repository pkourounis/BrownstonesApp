'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X, Loader2, Copy } from 'lucide-react';
import type { AppRole, Location } from '@/lib/database.types';
import { createAppUser } from './actions';

const ROLES: [AppRole, string][] = [
  ['employee', 'Employee'],
  ['manager', 'Manager'],
  ['super_admin', 'Super Admin'],
];

export function AddPerson({ locations }: { locations: Pick<Location, 'id' | 'name'>[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', role: 'manager' as AppRole, primary_location_id: locations[0]?.id ?? '' });
  const [temp, setTemp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createAppUser({ ...f, primary_location_id: f.primary_location_id || null });
      if (res.ok) { setTemp(res.tempPassword ?? null); router.refresh(); }
      else setError(res.error ?? 'Could not add.');
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary h-9 px-3 text-xs"><UserPlus size={15} /> Add person</button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
      <div className="max-h-[92vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Add manager or admin</h2>
          <button onClick={() => { setOpen(false); setTemp(null); }} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
        </div>

        {temp ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-gold-400 bg-gold-100 p-3">
              <p className="text-sm font-medium text-brand-900">Account created</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-sm text-brand-900">{temp}</code>
                <button type="button" onClick={() => navigator.clipboard?.writeText(temp)} className="btn-secondary h-8 px-2 text-xs"><Copy size={14} /> Copy</button>
              </div>
              <p className="mt-2 text-xs text-brand-600">Give {f.first_name || 'them'} this temporary password with their email ({f.email}). They&apos;ll change it at first sign-in.</p>
            </div>
            <button onClick={() => { setOpen(false); setTemp(null); setF({ first_name: '', last_name: '', email: '', role: 'manager', primary_location_id: locations[0]?.id ?? '' }); }} className="btn-primary h-9 w-full justify-center text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">First name</label><input className="input h-9 text-sm" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
              <div><label className="label">Last name</label><input className="input h-9 text-sm" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
            </div>
            <div><label className="label">Email</label><input type="email" className="input h-9 text-sm" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@brownstones.coffee" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Role</label>
                <select className="input h-9 text-sm" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AppRole })}>
                  {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Home store</label>
                <select className="input h-9 text-sm" value={f.primary_location_id} onChange={(e) => setF({ ...f, primary_location_id: e.target.value })}>
                  <option value="">—</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={submit} disabled={pending} className="btn-primary h-10 w-full justify-center text-sm">
              {pending ? <Loader2 size={16} className="animate-spin" /> : <><UserPlus size={15} /> Create account</>}
            </button>
            {error && <p className="text-xs text-brick-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
