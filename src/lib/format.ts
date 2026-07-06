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
