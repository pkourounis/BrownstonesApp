'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AppSettings } from '@/lib/database.types';
import { updateAppSettings } from './actions';

function Uploader({ label, url, onUploaded }: { label: string; url: string | null; onUploaded: (url: string) => void }) {
  const supabase = createClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `branding/${label.toLowerCase()}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('resources').upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) { setErr(error.message); setBusy(false); return; }
    const { data } = supabase.storage.from('resources').getPublicUrl(path);
    onUploaded(data.publicUrl);
    setBusy(false);
    if (ref.current) ref.current.value = '';
  };

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-12 w-auto max-w-[120px] rounded border border-brand-100 bg-cream object-contain" />
        ) : (
          <span className="flex h-12 w-20 items-center justify-center rounded border border-dashed border-brand-200 text-[10px] text-brand-400">none</span>
        )}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-secondary h-9 px-3 text-sm">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {err && <p className="mt-1 text-xs text-brick-600">{err}</p>}
    </div>
  );
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [logo, setLogo] = useState(settings.logo_url);
  const [splash, setSplash] = useState(settings.splash_url);
  const [color, setColor] = useState(settings.primary_color ?? '#7a5428');

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await updateAppSettings({ logo_url: logo, splash_url: splash, primary_color: color });
      setMsg(res.ok ? 'Saved.' : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Branding</h2>
        <Uploader label="Logo" url={logo} onUploaded={setLogo} />
        <Uploader label="Splash" url={splash} onUploaded={setSplash} />
        <div>
          <label className="label">Primary color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-brand-200" />
            <input value={color} onChange={(e) => setColor(e.target.value)} className="input h-9 w-32 text-sm" />
          </div>
          <p className="mt-1 text-xs text-brand-500">Recolors the whole app — a full shade range is derived from this one color. Save, then refresh to see it.</p>
        </div>
      </div>

      <p className="text-xs text-brand-500">Scheduling defaults (sales/labor-hr, weekly cap, shift length) are set per store in <span className="font-medium text-brand-700">Admin → each location</span>.</p>

      <button onClick={save} disabled={pending} className="btn-primary w-full justify-center">
        {pending ? <Loader2 size={18} className="animate-spin" /> : 'Save settings'}
      </button>
      {msg && <p className="flex items-center justify-center gap-1.5 text-sm text-brand-700"><Check size={15} /> {msg}</p>}
    </div>
  );
}
