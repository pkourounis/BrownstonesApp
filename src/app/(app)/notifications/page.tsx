import Link from 'next/link';
import { Bell, MessageSquare, Megaphone, CalendarClock, Repeat2, CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import type { Notification, NotificationType } from '@/lib/database.types';
import { AutoMarkRead } from './mark-read';

export const dynamic = 'force-dynamic';

const ICON: Record<NotificationType, React.ComponentType<{ size?: number }>> = {
  schedule_published: CalendarDays,
  shift_changed: CalendarDays,
  time_off_reviewed: CalendarClock,
  swap_request: Repeat2,
  announcement: Megaphone,
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

export default async function NotificationsPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', me.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const items = (data as Notification[]) ?? [];
  const hasUnread = items.some((n) => !n.is_read);

  return (
    <div className="space-y-4">
      <AutoMarkRead hasUnread={hasUnread} />
      <h1 className="font-display text-2xl font-bold text-brand-900">Notifications</h1>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-12 text-center text-sm text-brand-500">
          <Bell size={28} className="text-brand-300" /> You&apos;re all caught up.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICON[n.type] ?? Bell;
            const body = (
              <div className={`card flex items-start gap-3 py-3 ${n.is_read ? '' : 'border-l-4 border-l-brand-600 bg-brand-50/40'}`}>
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
              <li key={n.id}>{n.link ? <Link href={n.link}>{body}</Link> : body}</li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
