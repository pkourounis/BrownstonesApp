import { Loader2 } from 'lucide-react';

/**
 * Instant fallback shown while an app route's server component loads (e.g. the
 * dashboard's Toast summary). Gives immediate feedback right after sign-in
 * instead of a blank gap.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-brand-500">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brownstones-logo.png" alt="" className="w-40 opacity-90" />
      <Loader2 size={22} className="animate-spin text-brand-700" />
    </div>
  );
}
