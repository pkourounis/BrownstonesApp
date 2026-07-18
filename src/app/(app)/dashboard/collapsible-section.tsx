'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ArrowRight } from 'lucide-react';

/**
 * A home-screen section whose body can be collapsed to keep the manager home
 * above the fold. Open/closed state is remembered per key in localStorage.
 */
export function CollapsibleSection({
  title,
  storageKey,
  defaultOpen = true,
  summary,
  linkHref,
  linkLabel,
  children,
}: {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  summary?: string;
  linkHref?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`bc-home-${storageKey}`);
    if (saved !== null) setOpen(saved === '1');
    setReady(true);
  }, [storageKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`bc-home-${storageKey}`, next ? '1' : '0');
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button onClick={toggle} className="group flex min-w-0 items-center gap-1.5 text-left" aria-expanded={open}>
          <ChevronDown size={16} className={`shrink-0 text-brand-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          <h2 className="truncate font-semibold text-brand-900">{title}</h2>
          {!open && summary && <span className="truncate text-xs text-brand-500">· {summary}</span>}
        </button>
        {linkHref && linkLabel && (
          <Link href={linkHref} className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700">
            {linkLabel} <ArrowRight size={14} />
          </Link>
        )}
      </div>
      <div className={(ready ? open : defaultOpen) ? '' : 'hidden'}>{children}</div>
    </section>
  );
}
