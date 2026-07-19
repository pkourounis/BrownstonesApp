'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThumbsUp, Trash2, MessageCircle, Send, Check, ShieldCheck, Pin, ChevronDown, Loader2 } from 'lucide-react';
import type { PostCategory } from '@/lib/database.types';
import { toggleReaction, deletePost, addComment, acknowledgePost, getAckStatus } from './actions';

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const CATEGORY: Partial<Record<PostCategory, { label: string; cls: string }>> = {
  announcement: { label: 'Announcement', cls: 'bg-brand-100 text-brand-700' },
  product: { label: 'New product', cls: 'bg-green-100 text-green-700' },
  seasonal: { label: 'Seasonal', cls: 'bg-amber-100 text-amber-700' },
  menu: { label: 'Menu change', cls: 'bg-blue-100 text-blue-700' },
};

// Left-edge accent so each category stands out in the stream.
const ACCENT: Partial<Record<PostCategory, string>> = {
  announcement: 'border-l-4 border-l-brand-600',
  product: 'border-l-4 border-l-green-500',
  seasonal: 'border-l-4 border-l-amber-500',
  menu: 'border-l-4 border-l-blue-500',
};

export type Media = { url: string; mime: string };
export type Comment = { id: string; author: string; authorId: string | null; avatar: string | null; body: string; createdAt: string };
export type Original = { author: string; title: string | null; body: string; category: PostCategory; photos: Media[] };

function Photos({ urls }: { urls: Media[] }) {
  if (urls.length === 0) return null;
  return (
    <div className={`mt-3 grid gap-2 ${urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {urls.map((m, i) =>
        m.mime.startsWith('video') ? (
          <video key={i} src={m.url} controls playsInline className="max-h-80 w-full rounded-lg bg-black object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={m.url} alt="" className="max-h-72 w-full rounded-lg object-cover" />
        )
      )}
    </div>
  );
}

function CatBadge({ category }: { category: PostCategory }) {
  const c = CATEGORY[category];
  if (!c) return null;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}>{c.label}</span>;
}

function AckTracker({ postId, ackCount }: { postId: string; ackCount: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ acked: string[]; pending: string[] } | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      const res = await getAckStatus(postId);
      if (res.ok) setData({ acked: res.acked ?? [], pending: res.pending ?? [] });
      setLoading(false);
    }
  };

  const total = data ? data.acked.length + data.pending.length : null;

  return (
    <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2">
      <button onClick={toggle} className="flex w-full items-center justify-between text-left text-xs font-semibold text-brand-700">
        <span>
          {data ? `${data.acked.length} of ${total} acknowledged` : `${ackCount} acknowledged`}
        </span>
        <ChevronDown size={15} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-xs">
          {loading ? (
            <p className="flex items-center gap-1.5 text-brand-400"><Loader2 size={13} className="animate-spin" /> Loading…</p>
          ) : data ? (
            <>
              {data.pending.length > 0 && (
                <div>
                  <p className="mb-0.5 font-semibold text-brick-600">Hasn&apos;t acknowledged ({data.pending.length})</p>
                  <p className="text-brand-600">{data.pending.join(', ')}</p>
                </div>
              )}
              <div>
                <p className="mb-0.5 font-semibold text-green-700">Acknowledged ({data.acked.length})</p>
                <p className="text-brand-600">{data.acked.length ? data.acked.join(', ') : 'No one yet.'}</p>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function PostCard(props: {
  id: string;
  author: string;
  authorId: string | null;
  avatar: string | null;
  scope: string;
  category: PostCategory;
  title: string | null;
  body: string;
  photos: Media[];
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
  pinned: boolean;
  comments: Comment[];
  requiresAck: boolean;
  ackedByMe: boolean;
  ackCount: number;
  canTrackAcks: boolean;
  original: Original | null;
}) {
  const {
    id, author, authorId, avatar, scope, category, title, body, photos, createdAt,
    likeCount, likedByMe, canDelete, pinned, comments,
    requiresAck, ackedByMe, ackCount, canTrackAcks, original,
  } = props;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [acked, setAcked] = useState(ackedByMe);

  const onLike = () => {
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    startTransition(async () => { await toggleReaction(id); router.refresh(); });
  };
  const onComment = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    startTransition(async () => { await addComment(id, text); router.refresh(); });
  };
  const onAck = () => {
    setAcked(true);
    startTransition(async () => { await acknowledgePost(id); router.refresh(); });
  };

  return (
    <div className={`card ${!original ? ACCENT[category] ?? '' : ''}`}>
      <div className="mb-2 flex items-center gap-2">
        {(() => {
          const av = avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-700">{author.slice(0, 1)}</span>
          );
          return authorId ? <Link href={`/directory/${authorId}`} className="shrink-0" aria-label={`View ${author}`}>{av}</Link> : av;
        })()}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-brand-900">
            {authorId ? <Link href={`/directory/${authorId}`} className="hover:underline">{author}</Link> : author}
            {original && <span className="font-normal text-brand-400"> reposted</span>}
          </p>
          <p className="text-[11px] text-brand-400">{fmt(createdAt)} · {scope}</p>
        </div>
        {pinned && (
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
            <Pin size={10} /> Pinned
          </span>
        )}
        {!original && <CatBadge category={category} />}
        {canDelete && (
          <button onClick={() => startTransition(async () => { await deletePost(id); router.refresh(); })} disabled={pending} className="text-brand-300 hover:text-brick-600" aria-label="Delete post">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {original ? (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-brand-800">{original.author}</span>
            <CatBadge category={original.category} />
          </div>
          {original.title && <p className="text-sm font-bold text-brand-900">{original.title}</p>}
          {original.body && <p className="whitespace-pre-wrap text-sm text-brand-700">{original.body}</p>}
          <Photos urls={original.photos} />
        </div>
      ) : (
        <>
          {title && <p className="mb-1 text-base font-bold text-brand-900">{title}</p>}
          {body && <p className="whitespace-pre-wrap text-sm text-brand-800">{body}</p>}
          <Photos urls={photos} />
        </>
      )}

      {requiresAck && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gold-100 px-3 py-2">
          {acked ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-700"><Check size={15} /> You acknowledged this</span>
          ) : (
            <>
              <span className="text-sm font-medium text-brand-800">Please acknowledge you&apos;ve seen this</span>
              <button onClick={onAck} disabled={pending} className="btn-primary h-8 shrink-0 px-3 text-xs"><ShieldCheck size={14} /> Acknowledge</button>
            </>
          )}
        </div>
      )}
      {requiresAck && canTrackAcks && <AckTracker postId={id} ackCount={ackCount} />}

      <div className="mt-3 flex items-center gap-2 border-t border-brand-50 pt-2 text-xs font-semibold text-brand-500">
        <button onClick={onLike} disabled={pending} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${liked ? 'bg-brand-700 text-white' : 'bg-brand-100'}`}>
          <ThumbsUp size={13} /> {count > 0 ? count : 'Like'}
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1">
          <MessageCircle size={13} /> {comments.length > 0 ? comments.length : ''} Comment
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-2 border-t border-brand-50 pt-2">
          {comments.map((c) => {
            const av = c.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-200 text-[10px] font-semibold text-brand-700">{c.author.slice(0, 1)}</span>
            );
            return (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                {c.authorId ? <Link href={`/directory/${c.authorId}`} className="mt-0.5">{av}</Link> : <span className="mt-0.5">{av}</span>}
                <div className="min-w-0">
                  {c.authorId
                    ? <Link href={`/directory/${c.authorId}`} className="font-semibold text-brand-800 hover:underline">{c.author}</Link>
                    : <span className="font-semibold text-brand-800">{c.author}</span>}{' '}
                  <span className="text-brand-700">{c.body}</span>
                  <span className="ml-1 text-[10px] text-brand-300">{fmt(c.createdAt)}</span>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onComment()} placeholder="Write a comment…" className="input h-9 flex-1 text-sm" />
            <button onClick={onComment} disabled={pending || !draft.trim()} className="btn-secondary h-9 w-9 shrink-0 justify-center p-0" aria-label="Send comment"><Send size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
