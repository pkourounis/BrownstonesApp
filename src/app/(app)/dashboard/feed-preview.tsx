import Link from 'next/link';
import { ArrowRight, Megaphone, Pin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import type { PostCategory } from '@/lib/database.types';

type Row = {
  id: string;
  title: string | null;
  body: string;
  category: PostCategory;
  pinned_until: string | null;
  created_at: string;
  location_id: string | null;
  author: { display_name: string | null; full_name: string | null; avatar_url: string | null } | null;
};

const CAT: Partial<Record<PostCategory, { label: string; cls: string }>> = {
  announcement: { label: 'Announcement', cls: 'bg-brand-100 text-brand-700' },
  product: { label: 'New product', cls: 'bg-green-100 text-green-700' },
  seasonal: { label: 'Seasonal', cls: 'bg-amber-100 text-amber-700' },
  menu: { label: 'Menu change', cls: 'bg-blue-100 text-blue-700' },
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export async function FeedPreview() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('posts')
    .select('id, title, body, category, pinned_until, created_at, location_id, author:profiles!posts_author_id_fkey(display_name, full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(20);

  let posts = ((data as unknown as Row[]) ?? []);
  const now = Date.now();
  posts = posts
    .sort((a, b) => {
      const ap = a.pinned_until && new Date(a.pinned_until).getTime() > now ? 1 : 0;
      const bp = b.pinned_until && new Date(b.pinned_until).getTime() > now ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 3);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-brand-900">Feed</h2>
        <Link href="/feed" className="flex items-center gap-1 text-sm font-medium text-brand-700">
          Open feed <ArrowRight size={14} />
        </Link>
      </div>
      {posts.length === 0 ? (
        <Link href="/feed" className="card flex items-center gap-3 text-sm text-brand-500 hover:border-brand-300">
          <Megaphone size={18} className="text-brand-400" /> Nothing posted yet — check the feed.
        </Link>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => {
            const pinned = !!p.pinned_until && new Date(p.pinned_until).getTime() > now;
            const cat = CAT[p.category];
            const author = p.author?.display_name || p.author?.full_name || 'Team';
            return (
              <li key={p.id}>
                <Link href="/feed" className="card block py-3 hover:border-brand-300">
                  <div className="flex items-center gap-2">
                    {p.author?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.author.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-200 text-[11px] font-semibold text-brand-700">
                        {author.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-brand-500">
                      {author} · {fmt(p.created_at)}
                    </span>
                    {pinned && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                        <Pin size={9} /> Pinned
                      </span>
                    )}
                    {cat && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.cls}`}>{cat.label}</span>}
                  </div>
                  {p.title && <p className="mt-1.5 truncate text-sm font-semibold text-brand-900">{p.title}</p>}
                  {p.body && <p className="mt-0.5 line-clamp-2 text-sm text-brand-700">{p.body}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
