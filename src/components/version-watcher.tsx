'use client';

import { useEffect, useRef } from 'react';

const OWN = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

/**
 * Detects a new deploy and reloads once, so an installed PWA never stays stuck
 * on stale code. Checks the server's build id when the app regains focus.
 */
export function VersionWatcher() {
  const reloading = useRef(false);

  useEffect(() => {
    if (OWN === 'dev') return; // local dev — do nothing
    let last = 0;

    const check = async () => {
      if (reloading.current || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < 30_000) return; // throttle
      last = now;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { v } = await res.json();
        if (v && v !== 'dev' && v !== OWN) {
          reloading.current = true;
          location.reload();
        }
      } catch {
        /* offline — ignore */
      }
    };

    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  return null;
}
