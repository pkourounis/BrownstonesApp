'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  UsersRound,
  Users,
  UserCircle,
  Settings,
  BarChart3,
  BookOpen,
  Bell,
  ClipboardCheck,
  Clock,
  MessageSquare,
  Megaphone,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { Profile, AppRole } from '@/lib/database.types';
import { roleLabel } from '@/lib/roles';
import { createClient } from '@/lib/supabase/client';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: AppRole[];
};

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/feed', label: 'Feed', icon: Megaphone, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/chat', label: 'Chat', icon: MessageSquare, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/directory', label: 'Team', icon: Users, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/resources', label: 'Resources', icon: BookOpen, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck, roles: ['super_admin', 'manager'] },
  { href: '/insights', label: 'Insights', icon: BarChart3, roles: ['super_admin', 'manager'] },
  { href: '/roster', label: 'Roster', icon: UsersRound, roles: ['super_admin', 'manager'] },
  { href: '/timesheets', label: 'Timesheets', icon: Clock, roles: ['super_admin', 'manager'] },
  { href: '/admin', label: 'Admin', icon: Settings, roles: ['super_admin'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['super_admin', 'manager', 'employee'] },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');

/** The shared nav list: icons + labels (labels hidden when the rail is collapsed). */
function NavLinks({
  items,
  pathname,
  collapsed,
  unread,
  onNavigate,
}: {
  items: Item[];
  pathname: string;
  collapsed: boolean;
  unread: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const badge = href === '/notifications' && unread > 0 ? unread : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              collapsed ? 'justify-center' : ''
            } ${active ? 'bg-brand-700 text-white' : 'text-brand-700 hover:bg-brand-100'}`}
          >
            <span className="relative">
              <Icon size={20} />
              {badge > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick-600 px-1 text-[10px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {!collapsed && badge > 0 && (
              <span className="rounded-full bg-brick-600 px-1.5 text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Two-letter initials from a name: first + last, else first two letters. */
function initialsOf(fullName: string | null, displayName: string | null): string {
  const src = (fullName || displayName || '').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'BC';
}

/** Profile photo, or a two-letter initials fallback circle. */
function Avatar({ url, initials, size = 36 }: { url: string | null; initials: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="shrink-0 rounded-full border border-brand-100 object-cover"
      style={{ height: size, width: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-200 font-semibold text-brand-700"
      style={{ height: size, width: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

function SignOutButton({ collapsed }: { collapsed?: boolean }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        title="Sign out"
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-500 hover:bg-brand-100 hover:text-brick-600 ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <LogOut size={18} />
        {!collapsed && <span>Sign out</span>}
      </button>
    </form>
  );
}

export function AppShell({ profile, children, unread = 0, logoUrl }: { profile: Profile; children: React.ReactNode; unread?: number; logoUrl?: string | null }) {
  const pathname = usePathname();
  const logo = logoUrl || '/brownstones-logo.png';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const name = profile.display_name || profile.full_name || 'Team member';
  const initials = initialsOf(profile.full_name, profile.display_name);
  const items = ITEMS.filter((i) => i.roles.includes(profile.role));

  // Live unread count: seed from the server value, bump on realtime inserts,
  // and clear when viewing the notifications page (which marks everything read).
  const [liveUnread, setLiveUnread] = useState(unread);
  useEffect(() => setLiveUnread(unread), [unread]);
  useEffect(() => {
    if (isActive(pathname, '/notifications')) setLiveUnread(0);
  }, [pathname]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notif-badge-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profile.id}` },
        () => setLiveUnread((n) => n + 1)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  // Restore the desktop collapse preference.
  useEffect(() => {
    setCollapsed(localStorage.getItem('nav-collapsed') === '1');
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape + scroll lock while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('nav-collapsed', next ? '1' : '0');
      return next;
    });

  return (
    <div className="min-h-screen">
      {/* ---------- Desktop sidebar (collapsible rail) ---------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-brand-100 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[4.75rem]' : 'w-60'
        }`}
      >
        <div className={`flex items-center justify-center border-b border-brand-100 ${collapsed ? 'h-16 px-2' : 'px-4 py-5'}`}>
          <Link href="/dashboard" aria-label="Brownstones Coffee home" className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt="Brownstones Coffee"
              className={collapsed ? 'h-9 w-auto' : 'h-auto w-44'}
            />
          </Link>
        </div>

        <NavLinks items={items} pathname={pathname} collapsed={collapsed} unread={liveUnread} />

        <div className="border-t border-brand-100 p-3">
          {collapsed ? (
            <Link href="/profile" aria-label="Your profile" className="mb-1 flex justify-center py-1">
              <Avatar url={profile.avatar_url} initials={initials} size={36} />
            </Link>
          ) : (
            <Link href="/profile" className="mb-1 flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-brand-100">
              <Avatar url={profile.avatar_url} initials={initials} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-900">{name}</p>
                <p className="text-[11px] uppercase tracking-wide text-brand-500">{roleLabel(profile.role)}</p>
              </div>
            </Link>
          )}
          <SignOutButton collapsed={collapsed} />
          <button
            onClick={toggleCollapse}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-400 hover:bg-brand-100 hover:text-brand-700 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-brand-100 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-800"
          >
            <Menu size={22} />
          </button>
          <Link href="/dashboard" aria-label="Brownstones Coffee home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Brownstones Coffee" className="h-9 w-auto" />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/notifications" aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-800">
            <Bell size={20} />
            {liveUnread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick-600 px-1 text-[9px] font-bold text-white">
                {liveUnread > 9 ? '9+' : liveUnread}
              </span>
            )}
          </Link>
          <Link href="/profile" aria-label="Your profile">
            <Avatar url={profile.avatar_url} initials={initials} size={36} />
          </Link>
        </div>
      </header>

      {/* ---------- Mobile drawer ---------- */}
      <div
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] flex-col border-r border-brand-100 bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-brand-100 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="Brownstones Coffee" className="h-11 w-auto" />
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-800"
          >
            <X size={20} />
          </button>
        </div>
        <NavLinks items={items} pathname={pathname} collapsed={false} unread={liveUnread} onNavigate={() => setMobileOpen(false)} />
        <div className="border-t border-brand-100 p-3">
          <SignOutButton />
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className={`transition-[padding] duration-200 print:pl-0 ${collapsed ? 'lg:pl-[4.75rem]' : 'lg:pl-60'}`}>
        <main className={`mx-auto px-4 pb-10 pt-4 ${isActive(pathname, '/chat') ? 'max-w-5xl' : isActive(pathname, '/dashboard') || isActive(pathname, '/schedule') || isActive(pathname, '/insights') || (isActive(pathname, '/directory') && pathname === '/directory') ? 'max-w-7xl' : 'max-w-2xl'}`}>{children}</main>
      </div>
    </div>
  );
}
