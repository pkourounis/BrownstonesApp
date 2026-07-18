'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import type { Location } from '@/lib/database.types';
import { createPost } from './actions';

export function Composer({ locations, canPostAll }: { locations: Pick<Location, 'id' | 'name'>[]; canPostAll: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!body.trim()) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createPost(fd);
      if (res.ok) {
        setBody('');
        router.refresh();
      } else {
        setError(res.error ?? 'Could not post.');
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share an announcement with the team…"
        className="input min-h-[70px] text-sm"
      />
      <div className="flex items-center gap-2">
        <select name="location_id" defaultValue={canPostAll ? 'all' : locations[0]?.id ?? ''} className="input h-9 flex-1 text-sm">
          {canPostAll && <option value="all">All locations</option>}
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button type="submit" disabled={pending || !body.trim()} className="btn-primary h-9 shrink-0 px-4 text-sm">
          <Send size={15} /> Post
        </button>
      </div>
      {error && <p className="text-xs text-brick-600">{error}</p>}
    </form>
  );
}
