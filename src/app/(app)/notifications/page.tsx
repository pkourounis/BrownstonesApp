import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import type { Notification } from '@/lib/database.types';
import { AutoMarkRead } from './mark-read';
import { NotificationList } from './notification-list';

export const dynamic = 'force-dynamic';

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
      <NotificationList items={items} />
    </div>
  );
}
