'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell, MessageSquare, Megaphone, CalendarClock, Repeat2, CalendarDays, Cake, X, Trash2 } from 'lucide-react';
import type { Notification, NotificationType } from '@/lib/database.types';
import { deleteNotification, clearRead } from './actions';

const ICON: Record<NotificationType, React.ComponentType<{ size?: number }>> = {
  schedule_published: CalendarDays,
  shift_changed: CalendarDays,
  time_off_reviewed: CalendarClock,
  swap_request: Repeat2,
  announcement: Megaphone,
  birthday: Cake,
  general: MessageSquare,
};

const rel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
};

function Item({ n, onDismiss }: { n: Notification; onDismiss: (id: string) => void }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const Icon = ICON[n.type] ?? Bell;

  const onStart = (x: number) => { startX.current = x; setDragging(true); };
  const onMove = (x: number) => { if (dragging) setDx(Math.min(0, x - startX.current)); };
  const onEnd = () => {
    setDragging(false);
    if (dx < -80) onDismiss(n.id);
    else setDx(0);
  };

  const inner = (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-900">{n.title}</p>
        {n.body && <p className="text-sm text-brand-600">{n.body}</p>}
        <p className="mt-0.5 text-[11px] text-brand-400">{rel(n.created_at)}</p>
      </div>
      {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
    </div>
  );

  return (
    <li className="relative overflow-hidden rounded-2xl">
      {/* Red "delete" backdrop revealed on swipe. */}
      <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-brick-500 pr-4 text-white">
        <Trash2 size={18} />
      </div>
      <div
        className={`relative flex items-start gap-2 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm ${n.is_read ? '' : 'border-l-4 border-l-brand-600 bg-brand-50/40'} ${dragging ? '' : 'transition-transform'}`}
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
      >
        <div className="min-w-0 flex-1">
          {n.link ? <Link href={n.link}>{inner}</Link> : inner}
        </div>
        <button
          onClick={() => onDismiss(n.id)}
          className="shrink-0 rounded-full p-1 text-brand-300 hover:bg-brand-100 hover:text-brick-600"
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    </li>
  );
}

export function NotificationList({ items }: { items: Notification[] }) {
  const [list, setList] = useState(items);
  const [, startTransition] = useTransition();

  const dismiss = (id: string) => {
    setList((cur) => cur.filter((n) => n.id !== id));
    startTransition(() => { deleteNotification(id); });
  };
  const clearAllRead = () => {
    setList((cur) => cur.filter((n) => !n.is_read));
    startTransition(() => { clearRead(); });
  };

  const hasRead = list.some((n) => n.is_read);

  if (list.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 py-12 text-center text-sm text-brand-500">
        <Bell size={28} className="text-brand-300" /> You&apos;re all caught up.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasRead && (
        <div className="flex justify-end">
          <button onClick={clearAllRead} className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brick-600">
            <Trash2 size={14} /> Clear read
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {list.map((n) => (
          <Item key={n.id} n={n} onDismiss={dismiss} />
        ))}
      </ul>
    </div>
  );
}
