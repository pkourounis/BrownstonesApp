'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// --- America/New_York wall-clock helpers (DST-safe) -------------------------

/** Convert an ET wall time (yyyy-mm-dd, "HH:MM") to a UTC ISO timestamp. */
function etWallToUtc(dateStr: string, time: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const nyAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
  return new Date(guess + (guess - nyAsUtc)).toISOString();
}

/** ET calendar date + wall time + weekday for a UTC instant. */
function etOf(iso: string): { date: string; time: string; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  const date = `${g('year')}-${g('month')}-${g('day')}`;
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return { date, time: `${g('hour')}:${g('minute')}`, dow };
}

/** Add n days to a yyyy-mm-dd string. */
function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const breakFor = (hours: number) => (hours >= 6 ? 30 : 0);

/** Create one draft shift from the week builder. */
export async function createShift(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const p_location = String(formData.get('location_id') ?? '');
  const p_date = String(formData.get('date') ?? '');
  const p_start = String(formData.get('start') ?? '');
  const p_end = String(formData.get('end') ?? '');
  const p_employee = String(formData.get('employee_id') ?? '') || null;
  const p_break = Number(formData.get('break') ?? 0) || 0;
  const p_role = String(formData.get('role') ?? '') || null;

  if (!p_location || !p_date || !p_start || !p_end) return { ok: false, error: 'Missing fields.' };

  const { error } = await supabase.rpc('create_shift', { p_location, p_date, p_start, p_end, p_break, p_employee, p_role });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true };
}

/** Edit a shift's assignee, times (ET wall-clock), and break. */
export async function updateShift(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');
  const date = String(formData.get('date') ?? '');
  const start = String(formData.get('start') ?? '');
  const end = String(formData.get('end') ?? '');
  const employee = String(formData.get('employee_id') ?? '') || null;
  const brk = Number(formData.get('break') ?? 0) || 0;
  const role = String(formData.get('role') ?? '').trim() || null;
  if (!id || !date || !start || !end) return { ok: false, error: 'Missing fields.' };

  const starts_at = etWallToUtc(date, start);
  const ends_at = etWallToUtc(end <= start ? addDaysStr(date, 1) : date, end);

  const { data, error } = await supabase
    .from('shifts')
    .update({ roster_employee_id: employee, starts_at, ends_at, break_minutes: Math.max(0, brk), role_title: role })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this shift.' };
  revalidatePath('/schedule/build');
  return { ok: true };
}

/** Delete a draft/published shift. */
export async function deleteShift(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true };
}

/**
 * Clear a store's week. scope 'draft' removes only unpublished draft shifts
 * (published shifts staff can already see are kept); 'all' removes every shift
 * in the week. Used to wipe an auto-filled / copied draft and start over.
 */
export async function clearWeek(
  location_id: string,
  monday: string,
  scope: 'draft' | 'all' = 'draft'
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireRole('super_admin', 'manager');
  // Lock past weeks — the whole week is before today.
  if (addDaysStr(monday, 6) < etToday()) return { ok: false, error: 'That week is in the past and cannot be cleared.' };
  const supabase = await createClient();

  const winStart = etWallToUtc(monday, '00:00');
  const winEnd = etWallToUtc(addDaysStr(monday, 7), '00:00');
  let q = supabase
    .from('shifts')
    .delete()
    .eq('location_id', location_id)
    .gte('starts_at', winStart)
    .lt('starts_at', winEnd);
  if (scope === 'draft') q = q.eq('status', 'draft');
  const { data, error } = await q.select('id');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true, count: data?.length ?? 0 };
}

/** ET calendar date (yyyy-mm-dd) for "today". */
function etToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/**
 * Clear a single day. scope 'draft' removes only draft shifts, 'all' removes
 * every shift that day. Past days are locked (can't clear history).
 */
export async function clearDay(
  location_id: string,
  date: string,
  scope: 'draft' | 'all' = 'draft'
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireRole('super_admin', 'manager');
  if (date < etToday()) return { ok: false, error: 'That day is in the past and cannot be cleared.' };
  const supabase = await createClient();

  const winStart = etWallToUtc(date, '00:00');
  const winEnd = etWallToUtc(addDaysStr(date, 1), '00:00');
  let q = supabase
    .from('shifts')
    .delete()
    .eq('location_id', location_id)
    .gte('starts_at', winStart)
    .lt('starts_at', winEnd);
  if (scope === 'draft') q = q.eq('status', 'draft');
  const { data, error } = await q.select('id');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true, count: data?.length ?? 0 };
}

/** Publish all draft shifts in a store's week (ET), making them visible to staff. */
export async function publishWeek(
  location_id: string,
  monday: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('publish_week', { p_location: location_id, p_monday: monday });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true, count: (data as number) ?? 0 };
}

type ShiftRow = { id: string; roster_employee_id: string | null; starts_at: string; ends_at: string; break_minutes: number; status: string };

/**
 * Duplicate a shift's time block to any number of days and/or people.
 * - days: target yyyy-mm-dd dates (defaults to the source's own day).
 * - employeeIds: target roster employees (defaults to the source's employee).
 * Creates the cartesian product as draft shifts, skipping exact duplicates.
 */
export async function duplicateShift(
  sourceId: string,
  opts: { days: string[]; employeeIds: (string | null)[] }
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const { data: src, error } = await supabase
    .from('shifts')
    .select('id, location_id, roster_employee_id, starts_at, ends_at, break_minutes')
    .eq('id', sourceId)
    .single();
  if (error || !src) return { ok: false, error: 'Shift not found.' };

  const from = etOf(src.starts_at);
  const to = etOf(src.ends_at);
  const overnight = to.date !== from.date;
  const days = opts.days.length ? opts.days : [from.date];
  const employees = opts.employeeIds.length ? opts.employeeIds : [src.roster_employee_id];

  const rows = [];
  for (const day of days) {
    const starts_at = etWallToUtc(day, from.time);
    const ends_at = etWallToUtc(overnight ? addDaysStr(day, 1) : day, to.time);
    for (const emp of employees) {
      // Skip if this employee already has an identical shift that day.
      if (day === from.date && emp === src.roster_employee_id) continue;
      rows.push({
        location_id: src.location_id,
        roster_employee_id: emp,
        starts_at,
        ends_at,
        break_minutes: src.break_minutes,
        status: 'draft',
      });
    }
  }
  if (!rows.length) return { ok: true, count: 0 };
  const { error: insErr } = await supabase.from('shifts').insert(rows);
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath('/schedule/build');
  return { ok: true, count: rows.length };
}

/** Copy the previous week's shifts into this week (same weekday + wall time), as drafts. */
export async function repeatLastWeek(
  location_id: string,
  monday: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const prevMonday = addDaysStr(monday, -7);
  const winStart = etWallToUtc(prevMonday, '00:00');
  const winEnd = etWallToUtc(monday, '00:00');
  const { data: prev, error } = await supabase
    .from('shifts')
    .select('id, roster_employee_id, starts_at, ends_at, break_minutes, status')
    .eq('location_id', location_id)
    .gte('starts_at', winStart)
    .lt('starts_at', winEnd);
  if (error) return { ok: false, error: error.message };
  const src = (prev ?? []) as ShiftRow[];
  if (!src.length) return { ok: true, count: 0 };

  const rows = src.map((s) => {
    const from = etOf(s.starts_at);
    const to = etOf(s.ends_at);
    const overnight = to.date !== from.date;
    const day = addDaysStr(from.date, 7);
    return {
      location_id,
      roster_employee_id: s.roster_employee_id,
      starts_at: etWallToUtc(day, from.time),
      ends_at: etWallToUtc(overnight ? addDaysStr(day, 1) : day, to.time),
      break_minutes: s.break_minutes,
      status: 'draft',
    };
  });
  const { error: insErr } = await supabase.from('shifts').insert(rows);
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath('/schedule/build');
  return { ok: true, count: rows.length };
}

type Emp = { id: string; first_name: string; last_name: string | null; role_title: string | null; rating: number | null; profile_id: string | null };
type Avail = { profile_id: string; day_of_week: number; start_time: string; end_time: string };

/** Return an employee's approved availability windows, or null if they have none on file at all (treat as flexible). */
function availableWindows(emp: Emp, byProfile: Map<string, Avail[]>): Avail[] | null {
  if (!emp.profile_id) return null; // no login → treat as flexible
  const all = byProfile.get(emp.profile_id);
  if (!all || all.length === 0) return null; // nothing submitted → flexible
  return all; // caller filters by day
}

/**
 * Auto-fill the week with draft shifts sized to demand. Clears existing DRAFT
 * shifts for the week first (published shifts are kept and count as coverage).
 * Greedy: for each day, cover the recommended concurrent staff per hour with
 * ~shiftLen-hour blocks, preferring higher-rated, available, under-scheduled
 * staff, and leaving an unassigned "open" shift where the roster runs out.
 */
export async function autoFillWeek(
  location_id: string,
  monday: string,
  opts?: { shiftLen?: number; maxWeeklyHours?: number }
): Promise<{ ok: boolean; error?: string; created?: number; open?: number }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data: loc } = await supabase.from('locations').select('labor_target_splh, weekly_hour_cap, shift_length').eq('id', location_id).maybeSingle();
  const shiftLen = Math.min(10, Math.max(4, opts?.shiftLen ?? loc?.shift_length ?? 6));
  const maxWeekly = Math.min(60, Math.max(10, opts?.maxWeeklyHours ?? loc?.weekly_hour_cap ?? 40));
  const target = Number(loc?.labor_target_splh) || 130;

  const [{ data: recoData }, { data: emps }] = await Promise.all([
    supabase.rpc('staffing_reco', { p_location: location_id, p_target: target }),
    supabase.from('employees').select('id, first_name, last_name, role_title, rating, profile_id').eq('active', true).eq('location_id', location_id),
  ]);
  const grid = ((recoData as { grid?: { dow: number; hour: number; reco: number }[] })?.grid ?? []);
  const roster = (emps ?? []) as Emp[];
  if (!grid.length) return { ok: false, error: 'No demand data yet — sync sales first.' };
  if (!roster.length) return { ok: false, error: 'No active employees at this store.' };

  // Approved availability by profile.
  const profileIds = roster.map((e) => e.profile_id).filter(Boolean) as string[];
  const byProfile = new Map<string, Avail[]>();
  if (profileIds.length) {
    const { data: av } = await supabase.from('availability').select('profile_id, day_of_week, start_time, end_time').in('profile_id', profileIds).eq('status', 'approved');
    for (const a of (av ?? []) as Avail[]) byProfile.set(a.profile_id, [...(byProfile.get(a.profile_id) ?? []), a]);
  }

  // Reco per (dow,hour).
  const recoAt = new Map<string, number>();
  for (const g of grid) recoAt.set(`${g.dow}-${g.hour}`, g.reco);

  // Clear existing drafts for the week; keep published as pre-existing coverage.
  const winStart = etWallToUtc(monday, '00:00');
  const winEnd = etWallToUtc(addDaysStr(monday, 7), '00:00');
  const { data: existing } = await supabase
    .from('shifts')
    .select('id, roster_employee_id, starts_at, ends_at, break_minutes, status')
    .eq('location_id', location_id)
    .gte('starts_at', winStart)
    .lt('starts_at', winEnd);
  const published = ((existing ?? []) as ShiftRow[]).filter((s) => s.status !== 'draft');
  const draftIds = ((existing ?? []) as ShiftRow[]).filter((s) => s.status === 'draft').map((s) => s.id);
  if (draftIds.length) await supabase.from('shifts').delete().in('id', draftIds);

  const weeklyHours = new Map<string, number>();
  const workingDay = new Set<string>(); // `${empId}-${date}`
  // Seed from published shifts so we don't double-book or blow past weekly max.
  for (const s of published) {
    if (!s.roster_employee_id) continue;
    const h = (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000;
    weeklyHours.set(s.roster_employee_id, (weeklyHours.get(s.roster_employee_id) ?? 0) + h);
    workingDay.add(`${s.roster_employee_id}-${etOf(s.starts_at).date}`);
  }

  const rows: { location_id: string; roster_employee_id: string | null; starts_at: string; ends_at: string; break_minutes: number; status: string }[] = [];
  let openCount = 0;

  for (let i = 0; i < 7; i++) {
    const date = addDaysStr(monday, i);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const hoursForDay = grid.filter((g) => g.dow === dow && g.reco > 0).map((g) => g.hour);
    if (!hoursForDay.length) continue; // store effectively closed that weekday
    const open = Math.min(...hoursForDay);
    const close = Math.max(...hoursForDay) + 1; // shifts end at the top of the last busy hour

    // Coverage counters over [open, close).
    const cover = new Map<number, number>();
    // Seed coverage from published shifts on this day.
    for (const s of published) {
      const st = etOf(s.starts_at);
      if (st.date !== date) continue;
      const sh = Number(st.time.split(':')[0]);
      const eh = Number(etOf(s.ends_at).time.split(':')[0]) || close;
      for (let h = sh; h < eh; h++) cover.set(h, (cover.get(h) ?? 0) + 1);
    }

    let guard = 0;
    while (guard++ < 40) {
      // Earliest under-covered hour.
      let target = -1;
      for (let h = open; h < close; h++) {
        if ((cover.get(h) ?? 0) < (recoAt.get(`${dow}-${h}`) ?? 0)) { target = h; break; }
      }
      if (target === -1) break;
      const start = target;
      const end = Math.min(target + shiftLen, close);
      const len = end - start;

      // Pick the best eligible employee.
      const candidates = roster
        .filter((e) => !workingDay.has(`${e.id}-${date}`))
        .filter((e) => (weeklyHours.get(e.id) ?? 0) + len <= maxWeekly)
        .filter((e) => {
          const wins = availableWindows(e, byProfile);
          if (wins === null) return true; // flexible
          const day = wins.filter((w) => w.day_of_week === dow);
          if (!day.length) return false; // has availability but not this weekday
          return day.some((w) => Number(w.start_time.slice(0, 2)) <= start && Number(w.end_time.slice(0, 2)) >= end);
        })
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (weeklyHours.get(a.id) ?? 0) - (weeklyHours.get(b.id) ?? 0));

      const chosen = candidates[0] ?? null;
      rows.push({
        location_id,
        roster_employee_id: chosen?.id ?? null,
        starts_at: etWallToUtc(date, `${String(start).padStart(2, '0')}:00`),
        ends_at: etWallToUtc(date, `${String(end).padStart(2, '0')}:00`),
        break_minutes: breakFor(len),
        status: 'draft',
      });
      for (let h = start; h < end; h++) cover.set(h, (cover.get(h) ?? 0) + 1);
      if (chosen) {
        weeklyHours.set(chosen.id, (weeklyHours.get(chosen.id) ?? 0) + len);
        workingDay.add(`${chosen.id}-${date}`);
      } else {
        openCount++;
      }
    }
  }

  if (rows.length) {
    const { error: insErr } = await supabase.from('shifts').insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }
  revalidatePath('/schedule/build');
  return { ok: true, created: rows.length, open: openCount };
}

export type ScheduleFinding = { level: 'warn' | 'info'; title: string; detail: string };

/** Rule-based review of the week's schedule: gaps, overtime, conflicts, coverage. */
export async function reviewSchedule(
  location_id: string,
  monday: string
): Promise<{ ok: boolean; error?: string; findings?: ScheduleFinding[] }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const winStart = etWallToUtc(monday, '00:00');
  const winEnd = etWallToUtc(addDaysStr(monday, 7), '00:00');
  const { data: locRow } = await supabase.from('locations').select('labor_target_splh').eq('id', location_id).maybeSingle();
  const target = Number(locRow?.labor_target_splh) || 130;
  const [{ data: shiftData }, { data: recoData }, { data: emps }] = await Promise.all([
    supabase.from('shifts').select('id, roster_employee_id, starts_at, ends_at, break_minutes, status').eq('location_id', location_id).gte('starts_at', winStart).lt('starts_at', winEnd),
    supabase.rpc('staffing_reco', { p_location: location_id, p_target: target }),
    supabase.from('employees').select('id, first_name, last_name, role_title, rating, profile_id').eq('active', true).eq('location_id', location_id),
  ]);
  const shifts = (shiftData ?? []) as ShiftRow[];
  const grid = ((recoData as { grid?: { dow: number; hour: number; reco: number }[] })?.grid ?? []);
  const roster = (emps ?? []) as Emp[];
  const nameById = new Map(roster.map((e) => [e.id, `${e.first_name} ${e.last_name ?? ''}`.trim()]));

  const findings: ScheduleFinding[] = [];
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Availability for conflict checks.
  const profileIds = roster.map((e) => e.profile_id).filter(Boolean) as string[];
  const byProfile = new Map<string, Avail[]>();
  if (profileIds.length) {
    const { data: av } = await supabase.from('availability').select('profile_id, day_of_week, start_time, end_time').in('profile_id', profileIds).eq('status', 'approved');
    for (const a of (av ?? []) as Avail[]) byProfile.set(a.profile_id, [...(byProfile.get(a.profile_id) ?? []), a]);
  }
  const empById = new Map(roster.map((e) => [e.id, e]));

  const hours = (s: ShiftRow) => Math.max(0, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000 - (s.break_minutes || 0) / 60);

  // 1. Unassigned (open) shifts.
  const open = shifts.filter((s) => !s.roster_employee_id);
  if (open.length) findings.push({ level: 'warn', title: `${open.length} unassigned shift${open.length === 1 ? '' : 's'}`, detail: 'Open shifts have no one assigned — fill them or put them up for grabs.' });

  // 2. Weekly overtime (>40h).
  const weekly = new Map<string, number>();
  for (const s of shifts) if (s.roster_employee_id) weekly.set(s.roster_employee_id, (weekly.get(s.roster_employee_id) ?? 0) + hours(s));
  for (const [id, h] of weekly) if (h > 40) findings.push({ level: 'warn', title: `${nameById.get(id) ?? 'Someone'} is at ${h.toFixed(1)}h`, detail: 'Over 40h/week — expect overtime pay. Consider redistributing hours.' });

  // 3. Same-day double-booking (overlapping shifts).
  const byEmpDay = new Map<string, ShiftRow[]>();
  for (const s of shifts) {
    if (!s.roster_employee_id) continue;
    const k = `${s.roster_employee_id}-${etOf(s.starts_at).date}`;
    byEmpDay.set(k, [...(byEmpDay.get(k) ?? []), s]);
  }
  for (const [k, list] of byEmpDay) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    for (let i = 1; i < sorted.length; i++) {
      if (new Date(sorted[i].starts_at) < new Date(sorted[i - 1].ends_at)) {
        const id = k.split('-')[0];
        findings.push({ level: 'warn', title: `${nameById.get(id) ?? 'Someone'} is double-booked`, detail: `Overlapping shifts on ${etOf(sorted[i].starts_at).date}.` });
        break;
      }
    }
  }

  // 4. Assigned outside approved availability.
  for (const s of shifts) {
    const e = s.roster_employee_id ? empById.get(s.roster_employee_id) : null;
    if (!e) continue;
    const wins = availableWindows(e, byProfile);
    if (wins === null) continue;
    const st = etOf(s.starts_at);
    const startH = Number(st.time.split(':')[0]);
    const endH = Number(etOf(s.ends_at).time.split(':')[0]) || 24;
    const day = wins.filter((w) => w.day_of_week === st.dow);
    const ok = day.some((w) => Number(w.start_time.slice(0, 2)) <= startH && Number(w.end_time.slice(0, 2)) >= endH);
    if (!ok) findings.push({ level: 'warn', title: `${nameById.get(e.id)} scheduled outside availability`, detail: `${DAY[st.dow]} ${st.time} isn't within their approved availability.` });
  }

  // 5. Coverage vs demand, per day.
  const recoByDow = new Map<number, number>();
  for (const g of grid) recoByDow.set(g.dow, (recoByDow.get(g.dow) ?? 0) + g.reco);
  const schedByDate = new Map<string, number>();
  for (const s of shifts) { const d = etOf(s.starts_at).date; schedByDate.set(d, (schedByDate.get(d) ?? 0) + hours(s)); }
  for (let i = 0; i < 7; i++) {
    const date = addDaysStr(monday, i);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const reco = recoByDow.get(dow) ?? 0;
    if (reco <= 0) continue;
    const sched = schedByDate.get(date) ?? 0;
    const gap = reco - sched;
    if (gap > 5) findings.push({ level: 'warn', title: `${DAY[dow]} looks understaffed`, detail: `${sched.toFixed(1)}h scheduled vs ~${reco.toFixed(0)}h recommended — add ~${Math.round(gap)}h.` });
    else if (gap < -6) findings.push({ level: 'info', title: `${DAY[dow]} may be overstaffed`, detail: `${sched.toFixed(1)}h scheduled vs ~${reco.toFixed(0)}h recommended — trim ~${Math.round(-gap)}h.` });
  }

  if (!findings.length) findings.push({ level: 'info', title: 'Looks good', detail: 'No staffing gaps, overtime, or conflicts found for this week.' });
  // Warnings first.
  findings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  return { ok: true, findings };
}
