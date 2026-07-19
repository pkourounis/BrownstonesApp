'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Send, ArrowLeft, Users, Hash, ImagePlus, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { notifyMessage } from './actions';

type Msg = { id: string; author_id: string | null; body: string; image_url: string | null; created_at: string };
type People = Record<string, { name: string; avatar: string | null }>;

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export function ChatRoom({
  channelId,
  initial,
  people,
  myId,
  title,
  kind,
  avatar,
}: {
  channelId: string;
  initial: Msg[];
  people: People;
  myId: string;
  title: string;
  kind: 'store' | 'managers' | 'dm';
  avatar: string | null;
}) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    else notifyMessage(channelId, text).catch(() => {}); // fan out push (best-effort)
    setSending(false);
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${channelId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('chat').upload(path, file, { contentType: file.type || undefined });
    if (!upErr) {
      const { data } = supabase.storage.from('chat').getPublicUrl(path);
      await supabase.from('chat_messages').insert({ channel_id: channelId, author_id: myId, body: '', image_url: data.publicUrl });
      notifyMessage(channelId, '📷 Photo').catch(() => {});
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-brand-100 px-3 py-2.5">
        <Link href="/chat" className="text-brand-500 hover:text-brand-800 md:hidden" aria-label="Back">
          <ArrowLeft size={20} />
        </Link>
        {kind === 'dm' ? (
          avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-200 text-sm font-semibold text-brand-700">
              {title.slice(0, 1).toUpperCase()}
            </span>
          )
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-white">
            {kind === 'managers' ? <Users size={16} /> : <Hash size={16} />}
          </span>
        )}
        <p className="truncate font-semibold text-brand-900">{title}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-brand-400">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === myId;
            const who = m.author_id ? people[m.author_id] : null;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                {!mine &&
                  (m.author_id ? (
                    <Link href={`/directory/${m.author_id}`} className="shrink-0 self-end" aria-label={`View ${who?.name ?? 'profile'}`}>
                      {who?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={who.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-200 text-[10px] font-semibold text-brand-700">
                          {(who?.name ?? '?').slice(0, 1)}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <span className="flex h-7 w-7 shrink-0 self-end items-center justify-center rounded-full bg-brand-200 text-[10px] font-semibold text-brand-700">?</span>
                  ))}
                <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!mine && (
                    m.author_id
                      ? <Link href={`/directory/${m.author_id}`} className="mb-0.5 px-1 text-[11px] text-brand-400 hover:text-brand-700">{who?.name ?? 'Someone'}</Link>
                      : <span className="mb-0.5 px-1 text-[11px] text-brand-400">{who?.name ?? 'Someone'}</span>
                  )}
                  <div className={`overflow-hidden rounded-2xl text-sm ${mine ? 'bg-brand-700 text-white' : 'bg-white text-brand-800 shadow-sm'} ${m.image_url && !m.body ? '' : 'px-3 py-2'}`}>
                    {m.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={m.image_url} alt="" className="max-h-64 w-full rounded-2xl object-cover" />
                      </a>
                    )}
                    {m.body && <p className={`whitespace-pre-wrap break-words ${m.image_url ? 'px-3 py-2' : ''}`}>{m.body}</p>}
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-brand-300">{fmt(m.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-brand-100 px-3 py-2.5">
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary h-11 w-11 shrink-0 justify-center p-0" aria-label="Add photo">
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
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
