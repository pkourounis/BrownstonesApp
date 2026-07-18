import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import type { ChatChannel, ChatMessage } from '@/lib/database.types';
import { ChatRoom } from './chat-room';
import { ConversationList, type Convo } from './conversation-list';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: chans } = await supabase.from('chat_channels').select('*');
  const channels = (chans ?? []) as ChatChannel[];
  const channelIds = channels.map((c) => c.id);

  // Resolve DM other-members, everyone's display info, and last message per channel.
  const dmIds = channels.filter((c) => c.kind === 'dm').map((c) => c.id);
  const [{ data: members }, { data: profs }, { data: recent }] = await Promise.all([
    dmIds.length
      ? supabase.from('chat_channel_members').select('channel_id, profile_id').in('channel_id', dmIds)
      : Promise.resolve({ data: [] as { channel_id: string; profile_id: string }[] }),
    supabase.from('profiles').select('id, display_name, full_name, avatar_url, primary_location_id, employment_status'),
    channelIds.length
      ? supabase.from('chat_messages').select('channel_id, body, created_at').in('channel_id', channelIds).order('created_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [] as { channel_id: string; body: string; created_at: string }[] }),
  ]);

  const people: Record<string, { name: string; avatar: string | null }> = {};
  for (const p of profs ?? []) people[p.id] = { name: p.display_name || p.full_name || 'Team', avatar: p.avatar_url };

  const dmOther = new Map<string, string>();
  for (const m of members ?? []) if (m.profile_id !== profile.id) dmOther.set(m.channel_id, m.profile_id);

  // Latest message per channel (recent is sorted newest-first, so first seen wins).
  const last = new Map<string, { body: string; created_at: string }>();
  for (const m of recent ?? []) if (!last.has(m.channel_id)) last.set(m.channel_id, { body: m.body, created_at: m.created_at });

  const meta = (c: ChatChannel): { label: string; avatar: string | null } => {
    if (c.kind === 'dm') {
      const other = people[dmOther.get(c.id) ?? ''];
      return { label: other?.name ?? 'Direct message', avatar: other?.avatar ?? null };
    }
    return { label: c.kind === 'managers' ? 'Managers' : c.name, avatar: null };
  };

  const convos: Convo[] = channels
    .map((c) => {
      const m = meta(c);
      const lm = last.get(c.id);
      return { id: c.id, kind: c.kind, label: m.label, avatar: m.avatar, preview: lm?.body ?? '', time: lm?.created_at ?? null };
    })
    // Most-recently-active first; channels with no messages fall to the bottom by kind.
    .sort((a, b) => {
      if (a.time && b.time) return new Date(b.time).getTime() - new Date(a.time).getTime();
      if (a.time) return -1;
      if (b.time) return 1;
      const order = (k: Convo['kind']) => (k === 'store' ? 0 : k === 'managers' ? 1 : 2);
      return order(a.kind) - order(b.kind) || a.label.localeCompare(b.label);
    });

  const active = channels.find((c) => c.id === sp.c) ?? null;

  // Teammates you can DM: same store (or everyone for super-admin), excluding yourself.
  const teammates = (profs ?? [])
    .filter((p) => p.id !== profile.id && p.employment_status !== 'inactive')
    .filter((p) => profile.role === 'super_admin' || (p.primary_location_id && p.primary_location_id === profile.primary_location_id))
    .map((p) => ({ id: p.id, name: p.display_name || p.full_name || 'Team' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let initial: ChatMessage[] = [];
  if (active) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, author_id, body, created_at')
      .eq('channel_id', active.id)
      .order('created_at')
      .limit(100);
    initial = (msgs as ChatMessage[]) ?? [];
  }

  const activeMeta = active ? meta(active) : null;

  return (
    <div className="-mx-4 -my-4 flex h-[calc(100vh-4rem)] overflow-hidden md:mx-0 md:my-0 md:rounded-2xl md:border md:border-brand-100 md:bg-white">
      {/* Conversation list — full width on mobile until a chat is open */}
      <aside className={`w-full border-brand-100 bg-white md:w-80 md:shrink-0 md:border-r ${active ? 'hidden md:block' : 'block'}`}>
        <div className="border-b border-brand-100 px-4 pb-3 pt-4">
          <h1 className="font-display text-2xl font-bold text-brand-900">Chat</h1>
        </div>
        <div className="h-[calc(100%-4.75rem)] pt-3">
          <ConversationList convos={convos} activeId={active?.id ?? null} teammates={teammates} />
        </div>
      </aside>

      {/* Thread */}
      <main className={`min-w-0 flex-1 bg-cream ${active ? 'block' : 'hidden md:block'}`}>
        {active && activeMeta ? (
          <ChatRoom
            channelId={active.id}
            initial={initial}
            people={people}
            myId={profile.id}
            title={activeMeta.label}
            kind={active.kind}
            avatar={activeMeta.avatar}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-brand-400">
            Select a conversation or start a new message.
          </div>
        )}
      </main>
    </div>
  );
}
