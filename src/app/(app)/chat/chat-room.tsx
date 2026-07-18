'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Msg = { id: string; author_id: string | null; body: string; created_at: string };
type People = Record<string, { name: string; avatar: string | null }>;

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export function ChatRoom({
  channelId,
  initial,
  people,
  myId,
}: {
  channelId: string;
  initial: Msg[];
  people: People;
  myId: string;
}) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const ch = supabase
      .channel(`room:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, channelId]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    const { error } = await supabase.from('chat_messages').insert({ channel_id: channelId, author_id: myId, body: text });
    if (error) setInput(text); // restore on failure
    setSending(false);
  };

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-brand-400">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === myId;
            const who = m.author_id ? people[m.author_id] : null;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                {!mine &&
                  (who?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={who.avatar} alt="" className="h-7 w-7 shrink-0 self-end rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 self-end items-center justify-center rounded-full bg-brand-200 text-[10px] font-semibold text-brand-700">
                      {(who?.name ?? '?').slice(0, 1)}
                    </span>
                  ))}
                <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!mine && <span className="mb-0.5 px-1 text-[11px] text-brand-400">{who?.name ?? 'Someone'}</span>}
                  <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-brand-700 text-white' : 'bg-white text-brand-800 shadow-sm'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-brand-300">{fmt(m.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-brand-100 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message…"
          className="input h-11 flex-1"
        />
        <button onClick={send} disabled={sending || !input.trim()} className="btn-primary h-11 w-11 shrink-0 justify-center p-0" aria-label="Send">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
