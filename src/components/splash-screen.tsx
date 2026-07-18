'use client';

import { useEffect, useState } from 'react';

/**
 * Quick mobile splash shown once per session, right after the app loads.
 * Shows the uploaded splash image if set, otherwise a designed default
 * (brand color + faded food photo + logo). Tap to dismiss.
 */
export function SplashScreen({ url }: { url: string | null }) {
  const [state, setState] = useState<'hidden' | 'shown' | 'leaving'>('hidden');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024) return; // mobile / tablet only
    if (sessionStorage.getItem('bc-splash')) return;
    sessionStorage.setItem('bc-splash', '1');
    setState('shown');
    const t1 = setTimeout(() => setState('leaving'), 1600);
    const t2 = setTimeout(() => setState('hidden'), 2150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (state === 'hidden') return null;

  return (
    <div
      onClick={() => setState('hidden')}
      className={`fixed inset-0 z-[100] transition-opacity duration-500 ${state === 'leaving' ? 'opacity-0' : 'opacity-100'}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/splash-food.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-cream/80 via-cream/55 to-cream/90" />
          <div className="relative z-10 flex flex-col items-center gap-5 px-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brownstones-logo.png" alt="Brownstones Coffee" className="w-60 drop-shadow-sm" />
            <span className="h-px w-16 bg-gold-400" />
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand-500">Team Portal</p>
          </div>
        </div>
      )}
    </div>
  );
}
