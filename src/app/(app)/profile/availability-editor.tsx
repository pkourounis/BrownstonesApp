'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DAY_NAMES } from '@/lib/format';
import type { Availability } from '@/lib/database.types';
import { Check, Loader2, Clock } from 'lucide-react';

type DayState = { available: boolean; start: string; end: string };

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  approved: { text: 'Approved', cls: 'bg-green-100 text-green-700' },
  pending: { text: 'Pending manager approval', cls: 'bg-amber-100 text-amber-700' },
  denied: { text: 'Denied — please adjust', cls: 'bg-brick-500/15 text-brick-600' },
};

export function AvailabilityEditor({
  profileId,
  initial,
}: {
  profileId: string;
  initial: Availability[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [days, setDays] = useState<DayState[]>(() =>
    Array.from({ length: 7 }, (_, dow) => {
      const row = initial.find((r) => r.day_of_week === dow);
      return {
        available: row?.is_available ?? false,
        start: row?.start_time ? row.start_time.slice(0, 5) : '09:00',
        end: row?.end_time ? row.end_time.slice(0, 5) : '17:00',
      };
    })
  );

  const initialStatus = initial.length
    ? initial.some((r) => r.status === 'pending')
      ? 'pending'
      : initial.some((r) => r.status === 'denied')
        ? 'denied'
        : 'approved'
    : null;

  const [status, setStatus] = useState<string | null>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (dow: number, patch: Partial<DayState>) =>
    setDays((prev) => prev.map((d, i) => (i === dow ? { ...d, ...patch } : d)));

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Replace this person's availability with the new set (pending approval).
    const { error: delErr } = await supabase.from('availability').delete().eq('profile_id', profileId);
    if (delErr) {
      setSaving(false);
      setError(delErr.message);
      return;
    }
    const rows = days
      .map((d, dow) => ({ ...d, dow }))
      .filter((d) => d.available)
      .map((d) => ({
        profile_id: profileId,
        day_of_week: d.dow,
        start_time: d.start,
        end_time: d.end,
        is_available: true,
        status: 'pending' as const,
      }));

    if (rows.length) {
      const { error: insErr } = await supabase.from('availability').insert(rows);
      if (insErr) {
        setSaving(false);
        setError(insErr.message);
        return;
      }
    }
    setSaving(false);
    setSaved(true);
    setStatus(rows.length ? 'pending' : null);
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-brand-900">
          <Clock size={18} className="text-brand-500" /> My availability
        </h2>
        {status && STATUS_LABEL[status] && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_LABEL[status].cls}`}>
            {STATUS_LABEL[status].text}
          </span>
        )}
      </div>
      <p className="text-xs text-brand-500">
        Set the days and hours you can work. Changes go to your manager for approval before they&apos;re used in scheduling.
      </p>

      <ul className="divide-y divide-brand-50">
        {days.map((d, dow) => (
          <li key={dow} className="flex items-center gap-2 py-2">
            <label className="flex w-28 shrink-0 items-center gap-2">
              <input
                type="checkbox"
                checked={d.available}
                onChange={(e) => update(dow, { available: e.target.checked })}
                className="h-4 w-4 accent-brand-700"
              />
              <span className="text-sm font-medium text-brand-900">{DAY_NAMES[dow]}</span>
            </label>
            {d.available ? (
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  type="time"
                  value={d.start}
                  onChange={(e) => update(dow, { start: e.target.value })}
                  className="input h-9 flex-1 text-sm"
                  aria-label={`${DAY_NAMES[dow]} start`}
                />
                <span className="text-brand-400">–</span>
                <input
                  type="time"
                  value={d.end}
                  onChange={(e) => update(dow, { end: e.target.value })}
                  className="input h-9 flex-1 text-sm"
                  aria-label={`${DAY_NAMES[dow]} end`}
                />
              </div>
            ) : (
              <span className="flex-1 text-sm text-brand-400">Not available</span>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="button" onClick={save} disabled={saving} className="btn-secondary w-full">
        {saving ? <Loader2 className="animate-spin" size={18} /> : saved ? (
          <>
            <Check size={18} /> Submitted for approval
          </>
        ) : (
          'Save availability'
        )}
      </button>
    </div>
  );
}
