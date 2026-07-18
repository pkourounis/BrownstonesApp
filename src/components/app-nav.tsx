'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserCircle,
  Settings,
  BarChart3,
  Clock,
  Menu,
  X,
} from 'lucide-react';
import type { AppRole } from '@/lib/database.types';
import { Wordmark } from '@/components/wordmark';

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: AppRole[];
};

const ITEMS: Item[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/team', label: 'Team', icon: Users, roles: ['super_admin', 'manager', 'employee'] },
  { href: '/insights', label: 'Insights', icon: BarChart3, roles: ['super_admin', 'manager'] },
  { href: '/timesheets', label: 'Timesheets', icon: Clock, roles: ['super_admin', 'manager'] },
  { href: '/admin', label: 'Admin', icon: Settings, roles: ['super_admin'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['super_admin', 'manager', 'employee'] },
];

/** Hamburger button + slide-out navigation drawer. */
export function SideNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => i.roles.includes(role));

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-500 hover:bg-brand-100 hover:text-brand-800"
      >
        <Menu size={22} />
      </button>

      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] flex-col border-r border-brand-100 bg-white shadow-xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-brand-100 px-4 py-4">
          <Wordmark size="sm" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-800"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-700 hover:bg-brand-100'
                }`}
              >
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
