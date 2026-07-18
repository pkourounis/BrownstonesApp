'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Send, Gauge, Sparkles, CopyPlus, ClipboardCheck, AlertTriangle, Info, X, Loader2 } from 'lucide-react';
import type { Location } from '@/lib/database.types';
import { publishWeek, autoFillWeek, repeatLastWeek, reviewSchedule, type ScheduleFinding } from './actions';

export function BuilderControls({
  locations,
  store,
  monday,
  weekLabel,
  draftCount,
}: {
  locations: Pick<Location, 'id' | 'name'>[];
  store: string | null;
  monday: string;
  weekLabel: string;
  draftCount: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'fill' | 'repeat' | 'review' | 'publish'>(null);
  const [findings, setFindings] = useState<ScheduleFinding[] | null>(null);

  const push = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || (k === 'store' && v === 'all')) p.delete(k);
      else p.set(k, v);
    });
    startTransition(() => router.push(`/schedule/build?${p.toString()}`));
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() + delta * 7);
    push({ week: d.toISOString().slice(0, 10) });
  };

  const onPublish = () => {
    if (!store) return;
    setMsg(null);
    setBusy('publish');
    startTransition(async () => {
      const res = await publishWeek(store, monday);
      setMsg(res.ok ? `Published ${res.count ?? 0} shift${res.count === 1 ? '' : 's'}.` : res.error ?? 'Publish failed.');
      setBusy(null);
      if (res.ok) router.refresh();
    });
  };

  const onAutoFill = () => {
    if (!store) return;
    if (draftCount > 0 && !confirm('Auto-fill replaces the current draft shifts for this week (published shifts are kept). Continue?')) return;
    setMsg(null);
    setBusy('fill');
    startTransition(async () => {
      const res = await autoFillWeek(store, monday);
      setMsg(res.ok ? `Drafted ${res.created ?? 0} shifts${res.open ? ` · ${res.open} open (no one available)` : ''}.` : res.error ?? 'Auto-fill failed.');
      setBusy(null);
      if (res.ok) router.refresh();
    });
  };

  const onRepeat = () => {
    if (!store) return;
    setMsg(null);
    setBusy('repeat');
    startTransition(async () => {
      const res = await repeatLastWeek(store, monday);
      setMsg(res.ok ? (res.count ? `Copied ${res.count} shifts from last week.` : 'Last week had no shifts to copy.') : res.error ?? 'Copy failed.');
      setBusy(null);
      if (res.ok) router.refresh();
    });
  };

  const onReview = () => {
    if (!store) return;
    setMsg(null);
    setBusy('review');
    startTransition(async () => {
      const res = await reviewSchedule(store, monday);
      setFindings(res.ok ? res.findings ?? [] : null);
      if (!res.ok) setMsg(res.error ?? 'Review failed.');
      setBusy(null);
    });
  };

  return (
    <div className={`space-y-3 ${pending && !busy ? 'opacity-60' : ''}`}>
      <select
        value={store ?? ''}
        onChange={(e) => push({ store: e.target.value })}
        className="input h-10 w-full text-sm"
        aria-label="Store"
      >
        <option value="">Pick a store…</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => shiftWeek(-1)} className="btn-secondary h-9 px-2" aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-brand-800">{weekLabel}</span>
        <button onClick={() => shiftWeek(1)} className="btn-secondary h-9 px-2" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      {store && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onAutoFill} disabled={pending} className="btn-secondary h-9 justify-center text-xs">
            {busy === 'fill' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Auto-fill week
          </button>
          <button onClick={onRepeat} disabled={pending} className="btn-secondary h-9 justify-center text-xs">
            {busy === 'repeat' ? <Loader2 size={14} className="animate-spin" /> : <CopyPlus size={14} />} Repeat last week
          </button>
          <button onClick={onReview} disabled={pending} className="btn-secondary h-9 justify-center text-xs">
            {busy === 'review' ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />} Review
          </button>
          <Link href={`/schedule/staffing?store=${store}`} className="btn-secondary h-9 justify-center text-xs">
            <Gauge size={14} /> Staffing guide
          </Link>
        </div>
      )}

      <button onClick={onPublish} disabled={pending || !store || draftCount === 0} className="btn-primary h-9 w-full justify-center text-xs">
        {busy === 'publish' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publish{draftCount > 0 ? ` (${draftCount})` : ''}
      </button>

      {msg && <p className="text-center text-xs text-brand-600">{msg}</p>}

      {findings && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-900">Schedule review</h3>
            <button onClick={() => setFindings(null)} className="text-brand-300 hover:text-brand-600" aria-label="Close review"><X size={16} /></button>
          </div>
          <ul className="space-y-2">
            {findings.map((f, i) => (
              <li key={i} className="flex gap-2">
                {f.level === 'warn' ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" /> : <Info size={15} className="mt-0.5 shrink-0 text-brand-400" />}
                <div>
                  <p className="text-sm font-medium text-brand-900">{f.title}</p>
                  <p className="text-xs text-brand-600">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
