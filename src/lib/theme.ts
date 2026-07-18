/** Runtime theming: derive the full brand shade ramp from a single color. */

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB | null {
  const m = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

const mix = (c: RGB, target: RGB, t: number): RGB =>
  [0, 1, 2].map((i) => Math.round(c[i] + (target[i] - c[i]) * t)) as RGB;

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [20, 14, 8]; // warm near-black so dark shades don't go flat grey

// How far each shade sits from the base (600) toward white (negative) / black.
const STOPS: Record<number, { to: 'w' | 'b'; t: number }> = {
  50: { to: 'w', t: 0.92 },
  100: { to: 'w', t: 0.82 },
  200: { to: 'w', t: 0.64 },
  300: { to: 'w', t: 0.46 },
  400: { to: 'w', t: 0.28 },
  500: { to: 'w', t: 0.12 },
  600: { to: 'w', t: 0 },
  700: { to: 'b', t: 0.14 },
  800: { to: 'b', t: 0.3 },
  900: { to: 'b', t: 0.44 },
  950: { to: 'b', t: 0.7 },
};

/**
 * CSS `:root { --brand-N: r g b; ... }` derived from a base color (treated as
 * the 600 shade). Returns '' if the color is invalid, so callers can no-op.
 */
export function brandScaleCss(hex: string | null | undefined): string {
  if (!hex) return '';
  const base = hexToRgb(hex);
  if (!base) return '';
  const vars = Object.entries(STOPS)
    .map(([shade, { to, t }]) => {
      const c = t === 0 ? base : mix(base, to === 'w' ? WHITE : BLACK, t);
      return `--brand-${shade}:${c[0]} ${c[1]} ${c[2]}`;
    })
    .join(';');
  return `:root{${vars}}`;
}
