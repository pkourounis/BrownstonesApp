'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus, RefreshCw, X } from 'lucide-react';
import type { Location } from '@/lib/database.types';
import { addEmployee, importFromToast } from './actions';

export function RosterControls({
  locations,
  store,
}: {
  locations: Pick<Location, 'id' | 'name'>[];
  store: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setStore = (v: string) => {
    const p = new URLSearchParams(params.toString());
    if (!v || v === 'all') p.delete('store');
    else p.set('store', v);
    startTransition(() => router.push(`/roster?${p.toString()}`));
  };

  const onImport = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await importFromToast();
      setMsg(res.ok ? `Imported ${res.count ?? 0} from Toast.` : res.error ?? 'Import failed.');
      if (res.ok) router.refresh();
    });
  };

  const onAdd = (formData: FormData) => {
    setMsg(null);
    startTransition(async () => {
      const res = await addEmployee(formData);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setMsg(res.error ?? 'Could not add employee.');
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={store ?? 'all'}
          onChange={(e) => setStore(e.target.value)}
          className="input h-9 min-w-0 flex-1 text-sm"
          aria-label="Store"
        >
          <option value="all">All stores</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button onClick={onImport} disabled={pending} className="btn-secondary h-9 shrink-0 px-3 text-xs" title="Refresh roster from Toast">
          <RefreshCw size={14} className={pending ? 'animate-spin' : ''} /> Toast
        </button>
        <button onClick={() => setOpen((v) => !v)} className="btn-primary h-9 shrink-0 px-3 text-xs">
          {open ? <X size={14} /> : <UserPlus size={14} />} {open ? 'Close' : 'Add'}
        </button>
      </div>

      {msg && <p className="text-xs text-brand-600">{msg}</p>}

      {open && (
        <form action={onAdd} className="card space-y-3 border-brand-200 bg-brand-50">
          <p className="font-semibold text-brand-900">New employee</p>
          <div className="grid grid-cols-2 gap-2">
            <input name="first_name" required placeholder="First name" className="input h-9 text-sm" />
            <input name="last_name" placeholder="Last name" className="input h-9 text-sm" />
          </div>
          <select name="location_id" defaultValue={store ?? ''} required className="input h-9 w-full text-sm">
            <option value="" disabled>
              Store…
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="role_title" placeholder="Role (e.g. Barista)" className="input h-9 text-sm" />
            <input name="default_wage" type="number" step="0.25" min="0" placeholder="Wage $/hr" className="input h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="email" type="email" placeholder="Email (optional)" className="input h-9 text-sm" />
            <input name="phone" placeholder="Phone (optional)" className="input h-9 text-sm" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary h-9 w-full text-sm">
            {pending ? 'Adding…' : 'Add to roster'}
          </button>
        </form>
      )}
    </div>
  );
}
