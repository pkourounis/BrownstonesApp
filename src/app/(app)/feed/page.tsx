import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import type { Location } from '@/lib/database.types';
import { Composer } from './composer';
import { PostCard } from './post-card';

export const dynamic = 'force-dynamic';

type PostRow = {
  id: string;
  body: string;
  pinned: boolean;
  created_at: string;
  location_id: string | null;
  author_id: string | null;
  author: { display_name: string | null; full_name: string | null; avatar_url: string | null } | null;
};

export default async function FeedPage() {
  const profile = await requireProfile();
  const manager = canManage(profile.role);
  const supabase = await createClient();

  const [{ data: postData }, { data: locs }] = await Promise.all([
    supabase
      .from('posts')
      .select('id, body, pinned, created_at, location_id, author_id, author:profiles!posts_author_id_fkey(display_name, full_name, avatar_url)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
  ]);

  const posts = (postData as unknown as PostRow[]) ?? [];
  const allLocs = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(allLocs.map((l) => [l.id, l.name]));

  // Reaction counts + whether the current user liked each post.
  const ids = posts.map((p) => p.id);
  const { data: reactions } = ids.length
    ? await supabase.from('post_reactions').select('post_id, profile_id').in('post_id', ids)
    : { data: [] };
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const r of reactions ?? []) {
    counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
    if (r.profile_id === profile.id) mine.add(r.post_id);
  }

  // Managers post to their locations; super-admins can post to all.
  const composerLocs = profile.role === 'super_admin' ? allLocs : allLocs.filter((l) => l.id === profile.primary_location_id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Feed</h1>
        <p className="text-sm text-brand-600">Company &amp; store announcements</p>
      </div>

      {manager && <Composer locations={composerLocs} canPostAll={profile.role === 'super_admin'} />}

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
              scope={p.location_id ? nameById.get(p.location_id) ?? 'Store' : 'All locations'}
              body={p.body}
              createdAt={p.created_at}
              likeCount={counts.get(p.id) ?? 0}
              likedByMe={mine.has(p.id)}
              canDelete={profile.role === 'super_admin' || p.author_id === profile.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
