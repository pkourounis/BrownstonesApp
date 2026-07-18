'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ImagePlus, X, Loader2, PenSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Location } from '@/lib/database.types';
import { createPost } from './actions';

type Attachment = { url: string; mime: string };

export function Composer({ locations, canPostAll }: { locations: Pick<Location, 'id' | 'name'>[]; canPostAll: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('post');
  const [audience, setAudience] = useState(canPostAll ? 'all' : locations[0]?.id ?? '');
  const [requireAck, setRequireAck] = useState(false);
  const [pin, setPin] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `posts/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('feed').upload(path, file);
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      const { data } = supabase.storage.from('feed').getPublicUrl(path);
      setAttachments((prev) => [...prev, { url: data.publicUrl, mime: file.type }]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const submit = () => {
    setError(null);
    if (!title.trim() && !body.trim()) return setError('Add a title or description.');
    startTransition(async () => {
      const res = await createPost({
        title,
        body,
        category,
        location_id: audience === 'all' ? null : audience,
        requires_ack: requireAck,
        pin,
        attachments,
      });
      if (res.ok) {
        setTitle('');
        setBody('');
        setAttachments([]);
        setRequireAck(false);
        setPin('');
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? 'Could not post.');
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-left text-sm text-brand-400 shadow-sm transition hover:border-brand-200 hover:text-brand-500"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-white">
          <PenSquare size={16} />
        </span>
        Share something with the team…
      </button>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-900">New post</h2>
        <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input font-semibold" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write an announcement, new product, menu change…" className="input min-h-[80px] text-sm" />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-900 text-white"
                aria-label="Remove"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input h-9 text-sm">
          <option value="post">Post</option>
          <option value="announcement">Announcement</option>
          <option value="product">New product</option>
          <option value="seasonal">Seasonal</option>
          <option value="menu">Menu change</option>
        </select>
        <select value={audience} onChange={(e) => setAudience(e.target.value)} className="input h-9 text-sm">
          {canPostAll && <option value="all">All stores &amp; employees</option>}
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={pin} onChange={(e) => setPin(e.target.value)} className="input h-9 text-sm">
          <option value="">Don&apos;t pin</option>
          <option value="1d">Pin 1 day</option>
          <option value="3d">Pin 3 days</option>
          <option value="1w">Pin 1 week</option>
          <option value="2w">Pin 2 weeks</option>
          <option value="forever">Pin until removed</option>
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-brand-100 px-2 text-xs text-brand-700">
          <input type="checkbox" checked={requireAck} onChange={(e) => setRequireAck(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          Require acknowledgment
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary h-9 px-3 text-sm">
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
        <button onClick={submit} disabled={pending || uploading} className="btn-primary h-9 flex-1 justify-center text-sm">
          <Send size={15} /> Publish
        </button>
      </div>
      {error && <p className="text-xs text-brick-600">{error}</p>}
    </div>
  );
}
