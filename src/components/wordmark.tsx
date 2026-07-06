/**
 * Text lockup that mirrors the Brownstones Coffee logo: "BROWNSTONES" in the
 * serif wordmark with letter-spaced "COFFEE" beneath, flanked by thin rules.
 * (Swap for the official logo image by dropping it in /public and using <img>.)
 */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const main =
    size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl';
  const sub =
    size === 'lg' ? 'text-[0.7rem]' : size === 'sm' ? 'text-[0.5rem]' : 'text-[0.55rem]';

  return (
    <span className="inline-flex flex-col items-center leading-none text-brand-600">
      <span className={`font-serif font-bold uppercase tracking-tight ${main}`}>
        Brownstones
      </span>
      <span className={`mt-1 flex w-full items-center gap-1.5 ${sub}`}>
        <span className="h-px flex-1 bg-gold-400" />
        <span className="font-semibold uppercase tracking-[0.45em] text-brand-600">
          Coffee
        </span>
        <span className="h-px flex-1 bg-gold-400" />
      </span>
    </span>
  );
}
