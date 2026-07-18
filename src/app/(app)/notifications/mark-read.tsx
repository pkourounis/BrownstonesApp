'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { markAllRead } from './actions';

/** Marks everything read shortly after the page opens. */
export function AutoMarkRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!hasUnread || done.current) return;
    done.current = true;
    const t = setTimeout(() => {
      markAllRead().then(() => router.refresh());
    }, 1200);
    return () => clearTimeout(t);
  }, [hasUnread, router]);
  return null;
}
