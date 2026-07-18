'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, Trash2, MessageCircle, Share2, Send, Check, ShieldCheck } from 'lucide-react';
import type { PostCategory } from '@/lib/database.types';
import { toggleReaction, deletePost, addComment, acknowledgePost } from './actions';

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const CATEGORY: Record<PostCategory, { label: string; cls: string }> = {
  announcement: { label: 'Announcement', cls: 'bg-brand-100 text-brand-700' },
  product: { label: 'New product', cls: 'bg-green-100 text-green-700' },
  seasonal: { label: 'Seasonal', cls: 'bg-amber-100 text-amber-700' },
  menu: { label: 'Menu change', cls: 'bg-blue-100 text-blue-700' },
};

export type Comment = { id: string; author: string; body: string; createdAt: string };

export function PostCard({
  id,
  author,
  avatar,
  scope,
  category,
  title,
  body,
  photos,
  createdAt,
  likeCount,
  likedByMe,
  canDelete,
  comments,
  requiresAck,
  ackedByMe,
  ackCount,
  isSuperAdmin,
}: {
  id: string;
  author: string;
  avatar: string | null;
  scope: string;
  category: PostCategory;
  title: string | null;
  body: string;
  photos: string[];
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  comments: Comment[];
  requiresAck: boolean;
  ackedByMe: boolean;
  ackCount: number;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [shared, setShared] = useState(false);
  const [acked, setAcked] = useState(ackedByMe);

  const cat = CATEGORY[category] ?? CATEGORY.announcement;

  const onAck = () => {
    setAcked(true);
    startTransition(async () => {
      await acknowledgePost(id);
      router.refresh();
    });
  };

  const onLike = () => {
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    startTransition(async () => {
      await toggleReaction(id);
      router.refresh();
    });
  };

  const onComment = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    startTransition(async () => {
      await addComment(id, text);
      router.refresh();
    });
  };

  const onShare = async () => {
    const url = `${window.location.origin}/feed`;
    try {
      if (navigator.share) await navigator.share({ title: 'Brownstones', text: body, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="card">
      <div className="mb-2 flex items-center gap-2">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-700">
            {author.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-brand-900">{author}</p>
          <p className="text-[11px] text-brand-400">{fmt(createdAt)} · {scope}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.cls}`}>{cat.label}</span>
        {canDelete && (
          <button
            onClick={() => startTransition(async () => { await deletePost(id); router.refresh(); })}
            disabled={pending}
            className="text-brand-300 hover:text-brick-600"
            aria-label="Delete post"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {title && <p className="mb-1 text-base font-bold text-brand-900">{title}</p>}
      {body && <p className="whitespace-pre-wrap text-sm text-brand-800">{body}</p>}

      {photos.length > 0 && (
        <div className={`mt-3 grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="max-h-72 w-full rounded-lg object-cover" />
          ))}
        </div>
      )}

      {requiresAck && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gold-100 px-3 py-2">
          {acked ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <Check size={15} /> You acknowledged this
            </span>
          ) : (
            <>
              <span className="text-sm font-medium text-brand-800">Please acknowledge you&apos;ve seen this</span>
              <button onClick={onAck} disabled={pending} className="btn-primary h-8 shrink-0 px-3 text-xs">
                <ShieldCheck size={14} /> Acknowledge
              </button>
            </>
          )}
        </div>
      )}
      {requiresAck && isSuperAdmin && (
        <p className="mt-1 text-xs text-brand-500">{ackCount} acknowledged</p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-brand-50 pt-2 text-xs font-semibold text-brand-500">
        <button onClick={onLike} disabled={pending} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${liked ? 'bg-brand-700 text-white' : 'bg-brand-100'}`}>
          <ThumbsUp size={13} /> {count > 0 ? count : 'Like'}
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1">
          <MessageCircle size={13} /> {comments.length > 0 ? comments.length : ''} Comment
        </button>
        <button onClick={onShare} className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1">
          {shared ? <Check size={13} /> : <Share2 size={13} />} {shared ? 'Shared' : 'Share'}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-2 border-t border-brand-50 pt-2">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-semibold text-brand-800">{c.author}</span>{' '}
              <span className="text-brand-700">{c.body}</span>
              <span className="ml-1 text-[10px] text-brand-300">{fmt(c.createdAt)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onComment()}
              placeholder="Write a comment…"
              className="input h-9 flex-1 text-sm"
            />
            <button onClick={onComment} disabled={pending || !draft.trim()} className="btn-secondary h-9 w-9 shrink-0 justify-center p-0" aria-label="Send comment">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
