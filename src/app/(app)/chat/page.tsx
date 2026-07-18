import Link from 'next/link';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import type { ChatChannel, ChatMessage } from '@/lib/database.types';
import { ChatRoom } from './chat-room';
import { NewDm } from './new-dm';

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

  // Resolve display names for DM channels (the other member) + teammates for the picker.
  const dmIds = channels.filter((c) => c.kind === 'dm').map((c) => c.id);
  const [{ data: members }, { data: profs }] = await Promise.all([
    dmIds.length
      ? supabase.from('chat_channel_members').select('channel_id, profile_id').in('channel_id', dmIds)
      : Promise.resolve({ data: [] as { channel_id: string; profile_id: string }[] }),
    supabase.from('profiles').select('id, display_name, full_name, avatar_url, primary_location_id, employment_status'),
  ]);

  const people: Record<string, { name: string; avatar: string | null }> = {};
  for (const p of profs ?? []) people[p.id] = { name: p.display_name || p.full_name || 'Team', avatar: p.avatar_url };

  const dmOther = new Map<string, string>();
  for (const m of members ?? []) if (m.profile_id !== profile.id) dmOther.set(m.channel_id, m.profile_id);

  // Order: store channel(s), Managers, then DMs.
  const order = (c: ChatChannel) => (c.kind === 'store' ? 0 : c.kind === 'managers' ? 1 : 2);
  channels.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));

  const label = (c: ChatChannel) =>
    c.kind === 'dm' ? people[dmOther.get(c.id) ?? '']?.name ?? 'Direct message' : c.kind === 'managers' ? 'Managers' : c.name;

  const active = channels.find((c) => c.id === sp.c) ?? channels[0];

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-brand-900">Chat</h1>
        <div className="relative">
          <NewDm teammates={teammates} />
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/chat?c=${c.id}`}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium ${
              c.id === active?.id ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-600'
            }`}
          >
            {c.kind === 'managers' && <Users size={13} />}
            {c.kind === 'store' ? `# ${label(c)}` : label(c)}
          </Link>
        ))}
      </div>

      {active ? (
        <ChatRoom channelId={active.id} initial={initial} people={people} myId={profile.id} />
      ) : (
        <div className="card text-center text-sm text-brand-500">
          No channels yet. Tap the compose button to message a teammate.
        </div>
      )}
    </div>
  );
}
