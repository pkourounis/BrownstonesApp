import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { AckList } from './ack-list';

type Row = { id: string; title: string | null; body: string; requires_ack: boolean; location_id: string | null };

/** Posts requiring acknowledgment that this user is an audience for and hasn't acked yet. */
export async function AckPrompt() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const scope = profile.primary_location_id
    ? `location_id.is.null,location_id.eq.${profile.primary_location_id}`
    : 'location_id.is.null';

  const { data: postData } = await supabase
    .from('posts')
    .select('id, title, body, requires_ack, location_id')
    .eq('requires_ack', true)
    .or(scope)
    .order('created_at', { ascending: false })
    .limit(25);

  const posts = (postData as Row[]) ?? [];
  if (posts.length === 0) return null;

  const ids = posts.map((p) => p.id);
  const { data: myAcks } = await supabase.from('post_acks').select('post_id').eq('profile_id', profile.id).in('post_id', ids);
  const acked = new Set((myAcks ?? []).map((a) => a.post_id));

  const items = posts.filter((p) => !acked.has(p.id)).map((p) => ({ id: p.id, title: p.title, body: p.body }));
  if (items.length === 0) return null;

  return <AckList items={items} />;
}
