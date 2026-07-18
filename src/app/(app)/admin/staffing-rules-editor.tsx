'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import type { StaffingRule } from '@/lib/database.types';
import { saveStaffingRules } from './actions';
import { StaffingGrid, rowsFromRules, rowsToInput, newRow, type StaffingRow } from './staffing-grid';

export function StaffingRulesEditor({ locationId, rules }: { locationId: string; rules: StaffingRule[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<StaffingRow[]>(() => (rules.length ? rowsFromRules(rules) : [newRow()]));

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveStaffingRules(locationId, rowsToInput(rows));
      setMsg(res.ok ? 'Staffing rules saved.' : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-semibold text-brand-900">Staffing rules</h2>
        <p className="text-xs text-brand-500">How many of each role this store needs on each day. The schedule builder compares these to what you&apos;ve scheduled and flags any shortfalls.</p>
      </div>

      <StaffingGrid rows={rows} setRows={setRows} />

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? <Loader2 size={18} className="animate-spin" /> : 'Save staffing rules'}
        </button>
        {msg && <span className="flex items-center gap-1.5 text-sm text-brand-700"><Check size={15} /> {msg}</span>}
      </div>
    </div>
  );
}
