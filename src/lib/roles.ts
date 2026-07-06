import type { AppRole } from '@/lib/database.types';

/** Pure, client-safe role helpers (no server-only imports). */

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'manager':
      return 'Manager';
    case 'employee':
      return 'Employee';
  }
}

export function canManage(role: AppRole): boolean {
  return role === 'super_admin' || role === 'manager';
}
