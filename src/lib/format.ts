import { format, parseISO } from 'date-fns';

export function shiftTimeRange(startsAt: string, endsAt: string): string {
  const s = parseISO(startsAt);
  const e = parseISO(endsAt);
  return `${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`;
}

export function shiftDay(startsAt: string): string {
  return format(parseISO(startsAt), 'EEE, MMM d');
}

export function shiftHours(startsAt: string, endsAt: string, breakMinutes = 0): number {
  const ms = parseISO(endsAt).getTime() - parseISO(startsAt).getTime();
  return Math.max(0, ms / 3_600_000 - breakMinutes / 60);
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Whole-dollar money, e.g. $8,091. */
export function money(n: number | null | undefined): string {
  return '$' + Math.round(Number(n ?? 0)).toLocaleString('en-US');
}

/** Money with cents, e.g. $8,090.89. */
export function money2(n: number | null | undefined): string {
  return '$' + Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Short hour label: 7 -> "7a", 12 -> "12p", 14 -> "2p". */
export function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM' -> 'Aug'. */
export function monthAbbr(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_ABBR[m - 1] ?? ym;
}
