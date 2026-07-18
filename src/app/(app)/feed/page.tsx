import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import type { Location, PostCategory } from '@/lib/database.types';
import { Composer } from './composer';
import { PostCard, type Comment } from './post-card';

export const dynamic = 'force-dynamic';

type PostRow = {
  id: string;
  title: string | null;
  body: string;
  category: PostCategory;
  requires_ack: boolean;
  pinned: boolean;
  created_at: string;
  location_id: string | null;
  author_id: string | null;
  author: { display_name: string | null; full_name: string | null; avatar_url: string | null } | null;
};
type CommentRow = {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
  author: { display_name: string | null; full_name: string | null } | null;
};

export default async function FeedPage() {
  const profile = await requireProfile();
  const isSuper = profile.role === 'super_admin';
  const supabase = await createClient();

  const [{ data: postData }, { data: locs }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, title, body, category, requires_ack, pinned, created_at, location_id, author_id, author:profiles!posts_author_id_fkey(display_name, full_name, avatar_url)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
  ]);

  const posts = (postData as unknown as PostRow[]) ?? [];
  const allLocs = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(allLocs.map((l) => [l.id, l.name]));
  const ids = posts.map((p) => p.id);

  const [{ data: reactions }, { data: commentData }, { data: attachData }, { data: ackData }] = await Promise.all([
    ids.length ? supabase.from('post_reactions').select('post_id, profile_id').in('post_id', ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from('post_comments')
          .select('id, post_id, body, created_at, author:profiles!post_comments_author_id_fkey(display_name, full_name)')
          .in('post_id', ids)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('post_attachments').select('post_id, url').in('post_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from('post_acks').select('post_id, profile_id').in('post_id', ids) : Promise.resolve({ data: [] }),
  ]);

  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const r of reactions ?? []) {
    likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
    if (r.profile_id === profile.id) likedByMe.add(r.post_id);
  }

  const commentsByPost = new Map<string, Comment[]>();
  for (const c of (commentData as unknown as CommentRow[]) ?? []) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push({ id: c.id, author: c.author?.display_name || c.author?.full_name || 'Team', body: c.body, createdAt: c.created_at });
    commentsByPost.set(c.post_id, list);
  }

  const photosByPost = new Map<string, string[]>();
  for (const a of attachData ?? []) {
    const list = photosByPost.get(a.post_id) ?? [];
    list.push(a.url);
    photosByPost.set(a.post_id, list);
  }

  const ackCount = new Map<string, number>();
  const ackedByMe = new Set<string>();
  for (const a of ackData ?? []) {
    ackCount.set(a.post_id, (ackCount.get(a.post_id) ?? 0) + 1);
    if (a.profile_id === profile.id) ackedByMe.add(a.post_id);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Feed</h1>
        <p className="text-sm text-brand-600">Company announcements, products &amp; menu updates</p>
      </div>

      {isSuper && <Composer locations={allLocs} />}

      {posts.length === 0 ? (
        <div className="card text-center text-sm text-brand-500">No announcements yet.</div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              id={p.id}
              author={p.author?.display_name || p.author?.full_name || 'Team'}
              avatar={p.author?.avatar_url ?? null}
              scope={p.location_id ? nameById.get(p.location_id) ?? 'Store' : 'All stores'}
              category={p.category}
              title={p.title}
              body={p.body}
              photos={photosByPost.get(p.id) ?? []}
              createdAt={p.created_at}
              likeCount={likeCount.get(p.id) ?? 0}
              likedByMe={likedByMe.has(p.id)}
              canDelete={isSuper || p.author_id === profile.id}
              comments={commentsByPost.get(p.id) ?? []}
              requiresAck={p.requires_ack}
              ackedByMe={ackedByMe.has(p.id)}
              ackCount={ackCount.get(p.id) ?? 0}
              isSuperAdmin={isSuper}
            />
          ))}
        </div>
      )}
    </div>
  );
}
