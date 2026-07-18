'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Video, LinkIcon, ExternalLink, Trash2, Check, ShieldCheck, Play } from 'lucide-react';
import type { ResourceKind } from '@/lib/database.types';
import { deleteResource, signOffResource } from './actions';

const KIND_ICON = { doc: FileText, video: Video, link: LinkIcon } as const;

export type ResourceItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  kind: ResourceKind;
  url: string;
  requiresSignoff: boolean;
  signedByMe: boolean;
  audienceLabel: string | null; // shown to super admins
};

export function ResourceCard({ r, canManage }: { r: ResourceItem; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signed, setSigned] = useState(r.signedByMe);
  const [confirmDel, setConfirmDel] = useState(false);
  const Icon = KIND_ICON[r.kind];

  const onSign = () => {
    setSigned(true);
    startTransition(async () => { await signOffResource(r.id); router.refresh(); });
  };
  const onDelete = () =>
    startTransition(async () => { await deleteResource(r.id); router.refresh(); });

  const isVideo = r.kind === 'video';

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isVideo ? 'bg-brick-500/10 text-brick-600' : r.kind === 'doc' ? 'bg-blue-100 text-blue-700' : 'bg-brand-100 text-brand-700'}`}>
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brand-900">{r.title}</p>
          {r.description && <p className="mt-0.5 text-sm text-brand-600">{r.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {canManage && r.audienceLabel && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-600">{r.audienceLabel}</span>
            )}
            {r.requiresSignoff && (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">Sign-off required</span>
            )}
          </div>
        </div>
        {canManage && (
          confirmDel ? (
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={onDelete} disabled={pending} className="rounded-lg bg-brick-600 px-2 py-1 text-xs font-semibold text-white">Delete</button>
              <button onClick={() => setConfirmDel(false)} className="text-xs text-brand-400">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="shrink-0 text-brand-300 hover:text-brick-600" aria-label="Delete resource"><Trash2 size={16} /></button>
          )
        )}
      </div>

      {isVideo && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(r.url) ? (
        <video src={r.url} controls playsInline className="mt-3 max-h-72 w-full rounded-lg bg-black object-contain" />
      ) : (
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3 h-9 w-full justify-center text-sm">
          {isVideo ? <><Play size={15} /> Watch</> : r.kind === 'doc' ? <><FileText size={15} /> Open document</> : <><ExternalLink size={15} /> Open link</>}
        </a>
      )}

      {r.requiresSignoff && (
        <div className="mt-2">
          {signed ? (
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-700"><Check size={15} /> You&apos;ve signed off</p>
          ) : (
            <button onClick={onSign} disabled={pending} className="btn-primary h-9 w-full justify-center text-sm"><ShieldCheck size={15} /> I&apos;ve read this</button>
          )}
        </div>
      )}
    </div>
  );
}
