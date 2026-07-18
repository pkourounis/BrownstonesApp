import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import type { ChatChannel, ChatMessage } from '@/lib/database.types';
import { ChatRoom } from './chat-room';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: chans } = await supabase
    .from('chat_channels')
    .select('*')
    .order('location_id', { ascending: true, nullsFirst: true })
    .order('name');
  const channels = (chans ?? []) as ChatChannel[];

  if (channels.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold text-brand-900">Chat</h1>
        <div className="card text-center text-sm text-brand-500">No channels available.</div>
      </div>
    );
  }

  const active = channels.find((c) => c.id === sp.c) ?? channels[0];

  const [{ data: msgs }, { data: profs }] = await Promise.all([
    supabase.from('chat_messages').select('id, author_id, body, created_at').eq('channel_id', active.id).order('created_at').limit(100),
    supabase.from('profiles').select('id, display_name, full_name, avatar_url'),
  ]);

  const people: Record<string, { name: string; avatar: string | null }> = {};
  for (const p of profs ?? []) {
    people[p.id] = { name: p.display_name || p.full_name || 'Team', avatar: p.avatar_url };
  }

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl font-bold text-brand-900">Chat</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/chat?c=${c.id}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              c.id === active.id ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-600'
            }`}
          >
            {c.location_id ? c.name : `# ${c.name}`}
          </Link>
        ))}
      </div>

      <ChatRoom channelId={active.id} initial={(msgs as ChatMessage[]) ?? []} people={people} myId={profile.id} />
    </div>
  );
}
