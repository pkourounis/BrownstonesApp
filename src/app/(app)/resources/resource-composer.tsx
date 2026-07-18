'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Upload, Loader2, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Department, Location, ResourceKind } from '@/lib/database.types';
import { createResource } from './actions';

const DEPARTMENTS: [Department, string][] = [
  ['foh', 'Front of House'],
  ['boh', 'Back of House'],
  ['management', 'Management'],
];

export function ResourceComposer({ locations }: { locations: Pick<Location, 'id' | 'name'>[] }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Manuals');
  const [kind, setKind] = useState<ResourceKind>('link');
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [requireSignoff, setRequireSignoff] = useState(false);
  const [audience, setAudience] = useState<'all' | 'managers' | 'store' | 'department'>('all');
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [department, setDepartment] = useState<Department>('foh');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle(''); setDescription(''); setCategory('Manuals'); setKind('link'); setUrl(''); setFileName(null);
    setRequireSignoff(false); setAudience('all'); setError(null);
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return setError('File is too large (max 50 MB).');
    setUploading(true);
    setError(null);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${kind}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('resources').upload(path, file, { contentType: file.type || undefined });
    if (upErr) { setError(upErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from('resources').getPublicUrl(path);
    setUrl(data.publicUrl);
    setFileName(file.name);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createResource({
        title, description, category, kind, url, requires_signoff: requireSignoff,
        audience,
        location_id: audience === 'store' ? locationId : null,
        department: audience === 'department' ? department : null,
      });
      if (res.ok) { reset(); setOpen(false); router.refresh(); }
      else setError(res.error ?? 'Could not save.');
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary h-9 px-3 text-xs">
        <Plus size={15} /> Add resource
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && !uploading && setOpen(false)}>
      <div className="max-h-[92vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Add resource</h2>
          <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Barista Training Manual)" className="input font-semibold" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" className="input min-h-[60px] text-sm" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Type</label>
            <select value={kind} onChange={(e) => { setKind(e.target.value as ResourceKind); setUrl(''); setFileName(null); }} className="input h-9 text-sm">
              <option value="link">Link</option>
              <option value="doc">Document</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Manuals" className="input h-9 text-sm" list="resource-categories" />
            <datalist id="resource-categories">
              <option value="Manuals" /><option value="Training" /><option value="Policies" /><option value="Recipes" /><option value="Links" /><option value="Onboarding" />
            </datalist>
          </div>
        </div>

        {kind === 'link' ? (
          <div>
            <label className="label">URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input h-9 text-sm" />
          </div>
        ) : (
          <div>
            <label className="label">{kind === 'video' ? 'Video file or URL' : 'File or URL'}</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary h-9 px-3 text-sm">
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload
              </button>
              <input value={url} onChange={(e) => { setUrl(e.target.value); setFileName(null); }} placeholder="…or paste a URL" className="input h-9 flex-1 text-sm" />
            </div>
            <input ref={fileRef} type="file" accept={kind === 'video' ? 'video/*' : '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*'} className="hidden" onChange={onFile} />
            {fileName && <p className="mt-1 text-xs text-green-700">Uploaded: {fileName}</p>}
          </div>
        )}

        <div>
          <label className="label">Who can see this?</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="input h-9 text-sm">
            <option value="all">Everyone</option>
            <option value="managers">Managers &amp; super admins only</option>
            <option value="store">A specific store</option>
            <option value="department">A specific department</option>
          </select>
          {audience === 'store' && (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="input mt-2 h-9 text-sm">
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {audience === 'department' && (
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className="input mt-2 h-9 text-sm">
              {DEPARTMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-brand-700">
          <input type="checkbox" checked={requireSignoff} onChange={(e) => setRequireSignoff(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          Require employees to sign off that they&apos;ve read it
        </label>

        <button onClick={submit} disabled={pending || uploading} className="btn-primary h-10 w-full justify-center text-sm">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={15} /> Publish resource</>}
        </button>
        {error && <p className="text-xs text-brick-600">{error}</p>}
      </div>
    </div>
  );
}
