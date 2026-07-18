'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, Trash2 } from 'lucide-react';
import { toggleReaction, deletePost } from './actions';

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export function PostCard({
  id,
  author,
  avatar,
  scope,
  body,
  createdAt,
  likeCount,
  likedByMe,
  canDelete,
}: {
  id: string;
  author: string;
  avatar: string | null;
  scope: string;
  body: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);

  const onLike = () => {
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    startTransition(async () => {
      await toggleReaction(id);
      router.refresh();
    });
  };

  const onDelete = () =>
    startTransition(async () => {
      await deletePost(id);
      router.refresh();
    });

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
        {canDelete && (
          <button onClick={onDelete} disabled={pending} className="text-brand-300 hover:text-brick-600" aria-label="Delete post">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-brand-800">{body}</p>
      <button
        onClick={onLike}
        disabled={pending}
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          liked ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-600'
        }`}
      >
        <ThumbsUp size={13} /> {count > 0 ? count : 'Like'}
      </button>
    </div>
  );
}
