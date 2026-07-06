'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserCircle,
  Settings,
} from 'lucide-react';
import type { AppRole } from '@/lib/database.types';

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
  { href: '/admin', label: 'Admin', icon: Settings, roles: ['super_admin'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['super_admin', 'manager', 'employee'] },
];

export function BottomNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.roles.includes(role));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? 'text-brand-700' : 'text-brand-400'
              }`}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
