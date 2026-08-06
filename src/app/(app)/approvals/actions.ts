'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, requireRole } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { revalidatePath } from 'next/cache';

/** Alert the managers/super admins responsible for a location. */
async function alertManagers(supabase: Awaited<ReturnType<typeof createClient>>, locationId: string | null, opts: { title: string; body: string; link: string }) {
  if (!locationId) return;
  const { data } = await supabase.rpc('location_managers', { p_location: locationId });
  await notify((data as string[]) ?? [], { type: 'general', ...opts });
}

const nowIso = () => new Date().toISOString();

/** A shift window in Eastern time, e.g. "Fri Aug 8 8:00 AM–4:00 PM" — for notifications. */
function fmtWhen(startsAt: string, endsAt: string): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(startsAt));
  const t = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  return `${day} ${t(startsAt)}–${t(endsAt)}`;
}

type Sb = Awaited<ReturnType<typeof createClient>>;

/** Notify every super admin (e.g. every no-show, company-wide). */
async function notifySuperAdmins(supabase: Sb, opts: { title: string; body: string; link: string }) {
  const { data } = await supabase.from('profiles').select('id').eq('role', 'super_admin');
  await notify(((data ?? []) as { id: string }[]).map((p) => p.id), { type: 'general', ...opts });
}

/** True if the profile already works a shift overlapping [startsAt, endsAt), ignoring excluded shift ids. */
async function hasConflict(supabase: Sb, profileId: string, startsAt: string, endsAt: string, exclude: string[]): Promise<boolean> {
  const { data: emps } = await supabase.from('employees').select('id').eq('profile_id', profileId);
  const empIds = (emps ?? []).map((e) => e.id);
  const orParts = [`employee_id.eq.${profileId}`];
  if (empIds.length) orParts.push(`roster_employee_id.in.(${empIds.join(',')})`);
  let q = supabase.from('shifts').select('id').or(orParts.join(',')).lt('starts_at', endsAt).gt('ends_at', startsAt);
  if (exclude.length) q = q.not('id', 'in', `(${exclude.join(',')})`);
  const { data } = await q;
  return (data ?? []).length > 0;
}

/** Assign a shift to a profile, linking their roster row at that location if any. */
async function reassign(supabase: Sb, shiftId: string, profileId: string, locationId: string) {
  const { data: emp } = await supabase.from('employees').select('id').eq('profile_id', profileId).eq('location_id', locationId).maybeSingle();
  await supabase.from('shifts').update({ employee_id: profileId, roster_employee_id: emp?.id ?? null }).eq('id', shiftId);
}

function refresh() {
  revalidatePath('/approvals');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
}

// --- Manager / super-admin decisions -----------------------------------------

export async function decideTimeOff(id: string, approve: boolean, note?: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const trimmed = (note ?? '').trim();
  // Enforce the 2-per-day cap on approval (SECURITY DEFINER; returns an error string or null).
  const { data: problem, error } = await supabase.rpc('set_timeoff_status', { p_id: id, p_approve: approve, p_note: trimmed || null });
  if (error) return { ok: false, error: error.message };
  if (problem) return { ok: false, error: problem };

  const { data: req } = await supabase.from('time_off_requests').select('profile_id').eq('id', id).single();
  if (req) {
    const base = approve ? 'Your time-off request was approved.' : 'Your time-off request was declined.';
    await notify([req.profile_id], {
      type: 'time_off_reviewed',
      title: `Time off ${approve ? 'approved' : 'declined'}`,
      body: trimmed ? `${base} — “${trimmed}”` : approve ? base : `${base} Check with your manager.`,
      link: '/schedule',
    });
  }
  refresh();
  return { ok: true };
}

export async function decideAvailability(id: string, approve: boolean, note?: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const trimmed = (note ?? '').trim();
  const { data, error } = await supabase
    .from('availability')
    .update({ status: approve ? 'approved' : 'denied', reviewed_by: me.id, reviewed_at: nowIso(), manager_note: trimmed || null })
    .eq('id', id)
    .select('id, profile_id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this request.' };
  const base = approve ? 'Your availability change was approved.' : 'Your availability change was declined.';
  await notify([data[0].profile_id], {
    type: 'general',
    title: `Availability ${approve ? 'approved' : 'declined'}`,
    body: trimmed ? `${base} — “${trimmed}”` : base,
    link: '/profile',
  });
  refresh();
  return { ok: true };
}

/**
 * Approve or deny a shift drop / swap. On approval:
 *   - if someone claimed it (requested_to set), reassign the shift to them;
 *   - if nobody claimed it, release the shift (make it an open shift).
 */
export async function decideSwap(id: string, approve: boolean, note?: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const trimmed = (note ?? '').trim();

  const { data: swap, error: readErr } = await supabase
    .from('shift_swap_requests')
    .select('id, shift_id, target_shift_id, requested_by, requested_to')
    .eq('id', id)
    .single();
  if (readErr || !swap) return { ok: false, error: 'Request not found.' };

  if (approve) {
    const { data: shift } = await supabase.from('shifts').select('id, location_id').eq('id', swap.shift_id).single();
    if (shift) {
      if (swap.target_shift_id && swap.requested_to) {
        // 1:1 trade — each person takes the other's shift.
        const { data: tgt } = await supabase.from('shifts').select('id, location_id').eq('id', swap.target_shift_id).single();
        await reassign(supabase, shift.id, swap.requested_to, shift.location_id);
        if (tgt) await reassign(supabase, tgt.id, swap.requested_by, tgt.location_id);
      } else if (swap.requested_to) {
        // Up-for-grabs claimed → reassign to the claimer.
        await reassign(supabase, shift.id, swap.requested_to, shift.location_id);
      } else {
        // Released: becomes an open shift.
        await supabase.from('shifts').update({ employee_id: null, roster_employee_id: null }).eq('id', shift.id);
      }
    }
  }

  const { data, error } = await supabase
    .from('shift_swap_requests')
    .update({ status: approve ? 'approved' : 'denied', reviewed_by: me.id, reviewed_at: nowIso(), manager_note: trimmed || null })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this request.' };

  const targets = [swap.requested_by, swap.requested_to].filter(Boolean) as string[];
  const base = approve
    ? swap.requested_to ? 'The shift is yours — check your schedule.' : 'Your shift was released and is now open.'
    : 'Your shift request was declined.';
  await notify(targets, {
    type: 'swap_request',
    title: `Shift ${approve ? 'approved' : 'declined'}`,
    body: trimmed ? `${base} — “${trimmed}”` : base,
    link: '/schedule',
  });
  refresh();
  return { ok: true };
}

// --- Employee requests -------------------------------------------------------

export async function requestTimeOff(input: { start_date: string; end_date: string; reason: string }): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();
  if (!input.reason.trim()) return { ok: false, error: 'Please add a reason for your time off.' };
  if (!input.start_date || !input.end_date) return { ok: false, error: 'Pick start and end dates.' };
  if (input.end_date < input.start_date) return { ok: false, error: 'End date is before the start date.' };
  // Rules (reason required, blackout days, 2-per-day cap) enforced in the RPC.
  const { data: problem, error } = await supabase.rpc('request_time_off', {
    p_start: input.start_date,
    p_end: input.end_date,
    p_reason: input.reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  if (problem) return { ok: false, error: problem };
  const name = me.display_name || me.full_name || 'A team member';
  await alertManagers(supabase, me.primary_location_id, {
    title: 'Time-off request',
    body: `${name} requested time off — review it in Approvals.`,
    link: '/approvals',
  });
  refresh();
  return { ok: true };
}

export async function cancelTimeOff(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('time_off_requests').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Put one of my shifts up for grabs (open drop). A reason is required. */
export async function offerShift(shiftId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();
  if (!note.trim()) return { ok: false, error: 'Please add a reason so a manager can approve it.' };

  // Confirm the shift is mine (assigned to my profile or my roster row).
  const { data: myEmps } = await supabase.from('employees').select('id').eq('profile_id', me.id);
  const myEmpIds = (myEmps ?? []).map((e) => e.id);
  const { data: shift } = await supabase.from('shifts').select('id, employee_id, roster_employee_id, location_id').eq('id', shiftId).single();
  const mine = shift && (shift.employee_id === me.id || (shift.roster_employee_id && myEmpIds.includes(shift.roster_employee_id)));
  if (!mine) return { ok: false, error: 'That shift isn’t assigned to you.' };

  // Don't double-offer.
  const { data: existing } = await supabase
    .from('shift_swap_requests')
    .select('id')
    .eq('shift_id', shiftId)
    .in('status', ['pending'])
    .maybeSingle();
  if (existing) return { ok: false, error: 'This shift is already up for grabs.' };

  const { error } = await supabase.from('shift_swap_requests').insert({
    shift_id: shiftId,
    requested_by: me.id,
    requested_to: null,
    note: note.trim(),
    status: 'pending',
  });
  if (error) return { ok: false, error: error.message };
  const name = me.display_name || me.full_name || 'A team member';
  await alertManagers(supabase, shift?.location_id ?? null, {
    title: 'Shift up for grabs',
    body: `${name} put a shift up for grabs — review it in Approvals.`,
    link: '/approvals',
  });
  refresh();
  return { ok: true };
}

/** Claim an open shift someone put up for grabs (awaits manager approval). */
export async function claimShift(swapId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();

  // Find the target shift so we can check for a time conflict first.
  const { data: swap } = await supabase.from('shift_swap_requests').select('shift_id, requested_to').eq('id', swapId).maybeSingle();
  if (!swap) return { ok: false, error: 'That shift is no longer available.' };
  if (swap.requested_to) return { ok: false, error: 'This shift was already claimed.' };
  const { data: target } = await supabase.from('shifts').select('starts_at, ends_at').eq('id', swap.shift_id).maybeSingle();
  if (target) {
    const { data: myEmps } = await supabase.from('employees').select('id').eq('profile_id', me.id);
    const myEmpIds = (myEmps ?? []).map((e) => e.id);
    // My shifts that overlap the target window (full or partial).
    let q = supabase.from('shifts').select('id, employee_id, roster_employee_id').lt('starts_at', target.ends_at).gt('ends_at', target.starts_at);
    const orParts = [`employee_id.eq.${me.id}`];
    if (myEmpIds.length) orParts.push(`roster_employee_id.in.(${myEmpIds.join(',')})`);
    q = q.or(orParts.join(','));
    const { data: overlap } = await q;
    if ((overlap ?? []).length) {
      return { ok: false, error: "You already work during this time, so you can't pick up this shift." };
    }
  }

  const { data, error } = await supabase
    .from('shift_swap_requests')
    .update({ requested_to: me.id })
    .eq('id', swapId)
    .is('requested_to', null)
    .select('id, shift_id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'This shift was already claimed.' };
  const { data: shift } = await supabase.from('shifts').select('location_id').eq('id', data[0].shift_id).single();
  const name = me.display_name || me.full_name || 'A team member';
  await alertManagers(supabase, shift?.location_id ?? null, {
    title: 'Shift claimed',
    body: `${name} wants to pick up an open shift — approve it in Approvals.`,
    link: '/approvals',
  });
  refresh();
  return { ok: true };
}

/** Cancel my own open drop before it's approved. */
export async function cancelOffer(swapId: string): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('shift_swap_requests').delete().eq('id', swapId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Propose a 1:1 trade: my shift for a coworker's shift. Coworker must accept, then a manager approves. */
export async function proposeSwap(myShiftId: string, targetShiftId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();
  if (myShiftId === targetShiftId) return { ok: false, error: 'Pick a different shift to trade for.' };

  // My shift must be mine, upcoming, published.
  const { data: myEmps } = await supabase.from('employees').select('id').eq('profile_id', me.id);
  const myEmpIds = (myEmps ?? []).map((e) => e.id);
  const { data: mine } = await supabase.from('shifts').select('id, starts_at, ends_at, status, employee_id, roster_employee_id, location_id').eq('id', myShiftId).maybeSingle();
  const isMine = mine && (mine.employee_id === me.id || (mine.roster_employee_id && myEmpIds.includes(mine.roster_employee_id)));
  if (!mine || !isMine) return { ok: false, error: 'That shift isn’t yours.' };
  if (mine.status !== 'published') return { ok: false, error: 'You can only trade a published shift.' };
  if (new Date(mine.starts_at).getTime() <= Date.now()) return { ok: false, error: 'That shift has already started.' };

  // Target must belong to a coworker (a login user) and be upcoming.
  const { data: tgt } = await supabase.from('shifts').select('id, starts_at, ends_at, status, employee_id').eq('id', targetShiftId).maybeSingle();
  if (!tgt || !tgt.employee_id || tgt.employee_id === me.id) return { ok: false, error: 'Pick a coworker’s upcoming shift to trade for.' };
  if (tgt.status !== 'published' || new Date(tgt.starts_at).getTime() <= Date.now()) return { ok: false, error: 'That shift isn’t available to trade.' };

  // Don't double-offer the same shift.
  const { data: existing } = await supabase.from('shift_swap_requests').select('id').eq('shift_id', myShiftId).eq('status', 'pending').maybeSingle();
  if (existing) return { ok: false, error: 'This shift already has a pending swap or offer.' };

  const { error } = await supabase.from('shift_swap_requests').insert({
    shift_id: myShiftId,
    target_shift_id: targetShiftId,
    requested_by: me.id,
    requested_to: tgt.employee_id,
    kind: 'swap',
    status: 'pending',
    coworker_accepted: false,
    note: note.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  const name = me.display_name || me.full_name || 'A teammate';
  await notify([tgt.employee_id], {
    type: 'swap_request',
    title: 'Shift swap request',
    body: `${name} wants to trade shifts with you — review it on your schedule.`,
    link: '/schedule',
  });
  refresh();
  return { ok: true };
}

/**
 * Coworker responds to something addressed to them:
 *   - a 1:1 swap proposal (target_shift_id set), or
 *   - a shift offered directly to them (target_shift_id null — a directed pickup).
 * Accept on an employee-initiated offer/swap goes to a manager; a manager's
 * directed offer applies immediately on accept.
 */
export async function respondSwap(swapId: string, accept: boolean, note?: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();
  const reason = (note ?? '').trim();
  const { data: swap } = await supabase
    .from('shift_swap_requests')
    .select('id, shift_id, target_shift_id, requested_by, requested_to, status, coworker_accepted, manager_offer')
    .eq('id', swapId)
    .maybeSingle();
  if (!swap) return { ok: false, error: 'Request not found.' };
  if (swap.requested_to !== me.id) return { ok: false, error: 'This isn’t addressed to you.' };
  if (swap.status !== 'pending' || swap.coworker_accepted) return { ok: false, error: 'This was already handled.' };

  const directedOffer = swap.target_shift_id === null; // a pickup offered straight to me, no trade
  const myName = me.display_name || me.full_name || 'A teammate';

  if (!accept) {
    await supabase.from('shift_swap_requests').update({ status: 'denied', coworker_note: reason || null }).eq('id', swapId);
    const label = directedOffer ? 'Your shift offer was declined' : 'Your shift swap was declined';
    await notify([swap.requested_by], { type: 'swap_request', title: directedOffer ? 'Offer declined' : 'Swap declined', body: reason ? `${label} — “${reason}”` : `${label}.`, link: '/schedule' });
    refresh();
    return { ok: true };
  }

  if (directedOffer) {
    const { data: s } = await supabase.from('shifts').select('id, starts_at, ends_at, location_id').eq('id', swap.shift_id).maybeSingle();
    if (!s) return { ok: false, error: 'That shift no longer exists.' };
    if (await hasConflict(supabase, me.id, s.starts_at, s.ends_at, [swap.shift_id])) {
      return { ok: false, error: 'You already work during that shift, so you can’t take it.' };
    }
    if (swap.manager_offer) {
      // A manager offered it directly → apply immediately.
      await reassign(supabase, s.id, me.id, s.location_id);
      await supabase.from('shift_swap_requests').update({ status: 'approved', coworker_accepted: true, coworker_note: reason || null, reviewed_at: nowIso() }).eq('id', swapId);
      await notify([swap.requested_by].filter((x) => x !== me.id), { type: 'swap_request', title: 'Shift picked up', body: `${myName} took the ${fmtWhen(s.starts_at, s.ends_at)} shift.`, link: '/schedule' });
      await notify([me.id], { type: 'shift_changed', title: 'Shift added', body: `You picked up the ${fmtWhen(s.starts_at, s.ends_at)} shift.`, link: '/schedule' });
      refresh();
      return { ok: true };
    }
    // Employee offered it → coworker accepts, then a manager approves.
    await supabase.from('shift_swap_requests').update({ coworker_accepted: true, coworker_note: reason || null }).eq('id', swapId);
    await alertManagers(supabase, s.location_id ?? null, { title: 'Shift pickup to approve', body: `${myName} accepted an offered shift — approve it in Approvals.`, link: '/approvals' });
    await notify([swap.requested_by], { type: 'swap_request', title: 'Offer accepted', body: `${myName} accepted your shift — pending manager approval.`, link: '/schedule' });
    refresh();
    return { ok: true };
  }

  // A 1:1 trade — target_shift_id is guaranteed set here.
  const targetShiftId = swap.target_shift_id as string;
  // Conflict checks for both people before it goes to a manager.
  const { data: a } = await supabase.from('shifts').select('starts_at, ends_at, location_id').eq('id', swap.shift_id).maybeSingle();
  const { data: b } = await supabase.from('shifts').select('starts_at, ends_at').eq('id', targetShiftId).maybeSingle();
  if (!a || !b) return { ok: false, error: 'One of the shifts no longer exists.' };
  if (await hasConflict(supabase, me.id, a.starts_at, a.ends_at, [targetShiftId])) {
    return { ok: false, error: 'You already work during that shift, so you can’t take it.' };
  }
  if (await hasConflict(supabase, swap.requested_by, b.starts_at, b.ends_at, [swap.shift_id])) {
    return { ok: false, error: 'Your coworker now has a conflicting shift — the trade can’t go through.' };
  }

  await supabase.from('shift_swap_requests').update({ coworker_accepted: true, coworker_note: reason || null }).eq('id', swapId);
  const name = me.display_name || me.full_name || 'A teammate';
  await alertManagers(supabase, a.location_id ?? null, {
    title: 'Shift swap to approve',
    body: `${name} accepted a shift swap${reason ? ` (“${reason}”)` : ''} — approve it in Approvals.`,
    link: '/approvals',
  });
  await notify([swap.requested_by], { type: 'swap_request', title: 'Swap accepted', body: reason ? `${name} accepted your swap — “${reason}”. Pending manager approval.` : `${name} accepted your swap — pending manager approval.`, link: '/schedule' });
  refresh();
  return { ok: true };
}

// --- Manager shift management ------------------------------------------------

/** Manager: edit a shift's time / break / role / notes. Applies immediately. */
export async function managerEditShift(
  shiftId: string,
  patch: { starts_at: string; ends_at: string; break_minutes: number; role_title: string | null; position_id: string | null; notes: string | null }
): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  if (!patch.starts_at || !patch.ends_at) return { ok: false, error: 'Set a start and end time.' };
  if (new Date(patch.ends_at).getTime() <= new Date(patch.starts_at).getTime()) return { ok: false, error: 'End time must be after the start time.' };

  const { data: before } = await supabase.from('shifts').select('employee_id').eq('id', shiftId).maybeSingle();
  if (before?.employee_id && (await hasConflict(supabase, before.employee_id, patch.starts_at, patch.ends_at, [shiftId]))) {
    return { ok: false, error: 'That person already works an overlapping shift then.' };
  }
  const { data, error } = await supabase
    .from('shifts')
    .update({
      starts_at: patch.starts_at,
      ends_at: patch.ends_at,
      break_minutes: Math.max(0, Math.round(patch.break_minutes || 0)),
      role_title: patch.role_title,
      position_id: patch.position_id,
      notes: patch.notes,
    })
    .eq('id', shiftId)
    .select('id, employee_id, starts_at, ends_at');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this shift.' };
  const s = data[0];
  if (s.employee_id) {
    await notify([s.employee_id], { type: 'shift_changed', title: 'Your shift changed', body: `Your shift is now ${fmtWhen(s.starts_at, s.ends_at)}.`, link: '/schedule' });
  }
  refresh();
  return { ok: true };
}

/** Manager: reassign a shift to another person (roster: / profile: token) or '' to open it. */
export async function managerReassignShift(shiftId: string, assignee: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data: shift } = await supabase.from('shifts').select('id, employee_id, location_id, starts_at, ends_at').eq('id', shiftId).maybeSingle();
  if (!shift) return { ok: false, error: 'Shift not found.' };

  let newProfileId: string | null = null;
  let newRosterId: string | null = null;
  if (assignee.startsWith('roster:')) {
    const { data: emp } = await supabase.from('employees').select('id, profile_id').eq('id', assignee.slice(7)).maybeSingle();
    if (!emp) return { ok: false, error: 'Person not found.' };
    newRosterId = emp.id;
    newProfileId = emp.profile_id;
  } else if (assignee.startsWith('profile:')) {
    newProfileId = assignee.slice(8);
    const { data: emp } = await supabase.from('employees').select('id').eq('profile_id', newProfileId).eq('location_id', shift.location_id).maybeSingle();
    newRosterId = emp?.id ?? null;
  }
  // '' → leave both null (open shift)

  if (newProfileId && (await hasConflict(supabase, newProfileId, shift.starts_at, shift.ends_at, [shiftId]))) {
    return { ok: false, error: 'That person already works an overlapping shift.' };
  }
  const { error } = await supabase.from('shifts').update({ employee_id: newProfileId, roster_employee_id: newRosterId }).eq('id', shiftId);
  if (error) return { ok: false, error: error.message };

  if (shift.employee_id && shift.employee_id !== newProfileId) {
    await notify([shift.employee_id], { type: 'shift_changed', title: 'Shift reassigned', body: `Your ${fmtWhen(shift.starts_at, shift.ends_at)} shift was reassigned to someone else.`, link: '/schedule' });
  }
  if (newProfileId && newProfileId !== shift.employee_id) {
    await notify([newProfileId], { type: 'shift_changed', title: 'New shift', body: `You were added to a shift: ${fmtWhen(shift.starts_at, shift.ends_at)}.`, link: '/schedule' });
  }
  refresh();
  return { ok: true };
}

/** Manager: delete a shift (and any pending swap/offer tied to it). */
export async function managerDeleteShift(shiftId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data: s } = await supabase.from('shifts').select('employee_id, starts_at, ends_at').eq('id', shiftId).maybeSingle();
  await supabase.from('shift_swap_requests').delete().or(`shift_id.eq.${shiftId},target_shift_id.eq.${shiftId}`);
  const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
  if (error) return { ok: false, error: error.message };
  if (s?.employee_id) {
    await notify([s.employee_id], { type: 'shift_changed', title: 'Shift removed', body: `Your ${fmtWhen(s.starts_at, s.ends_at)} shift was removed.`, link: '/schedule' });
  }
  refresh();
  return { ok: true };
}

export type AttendanceStatus = 'no_show' | 'sick' | 'called_out' | 'emergency_call_out' | 'went_home_sick' | 'left_early';
const ATTEND_LABEL: Record<AttendanceStatus, string> = {
  no_show: 'no-show',
  sick: 'sick',
  called_out: 'call-out',
  emergency_call_out: 'emergency call-out',
  went_home_sick: 'went home sick',
  left_early: 'left early',
};

/** Manager: tag a shift's attendance, or clear it (null). Every tag alerts super admins + the store's managers. */
export async function markAttendance(shiftId: string, status: AttendanceStatus | null): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shifts')
    .update({ attendance: status })
    .eq('id', shiftId)
    .select('id, employee_id, starts_at, ends_at, location_id, employee:profiles!shifts_employee_id_fkey(display_name, full_name)');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this shift.' };
  const s = data[0] as unknown as { employee_id: string | null; starts_at: string; ends_at: string; location_id: string | null; employee: { display_name: string | null; full_name: string | null } | null };
  const who = s.employee?.display_name || s.employee?.full_name || 'Someone';

  if (status) {
    const label = ATTEND_LABEL[status];
    if (s.employee_id) {
      await notify([s.employee_id], { type: 'shift_changed', title: `Marked ${label}`, body: `Your ${fmtWhen(s.starts_at, s.ends_at)} shift was marked ${label}.`, link: '/schedule' });
    }
    // Every attendance tag pings super admins and the store's managers.
    const title = `Attendance: ${label}`;
    const body = `${who} was marked ${label} for the ${fmtWhen(s.starts_at, s.ends_at)} shift.`;
    await notifySuperAdmins(supabase, { title, body, link: '/schedule' });
    await alertManagers(supabase, s.location_id ?? null, { title, body, link: '/schedule' });
  }
  refresh();
  return { ok: true };
}

/** Manager: put someone's shift up for grabs (open pickup others can claim, subject to approval). */
export async function makeAvailable(shiftId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data: shift } = await supabase.from('shifts').select('id, employee_id, location_id, starts_at, ends_at').eq('id', shiftId).maybeSingle();
  if (!shift) return { ok: false, error: 'Shift not found.' };
  if (!shift.employee_id) return { ok: false, error: 'No one is assigned — reassign it instead.' };
  const { data: existing } = await supabase.from('shift_swap_requests').select('id').eq('shift_id', shiftId).eq('status', 'pending').maybeSingle();
  if (existing) return { ok: false, error: 'This shift already has a pending offer or swap.' };

  const { error } = await supabase.from('shift_swap_requests').insert({
    shift_id: shiftId,
    requested_by: shift.employee_id,
    requested_to: null,
    kind: 'pickup',
    manager_offer: true,
    note: (note ?? '').trim() || 'Made available by a manager',
    status: 'pending',
  });
  if (error) return { ok: false, error: error.message };
  await notify([shift.employee_id], { type: 'shift_changed', title: 'Shift up for grabs', body: `Your ${fmtWhen(shift.starts_at, shift.ends_at)} shift was put up for grabs.`, link: '/schedule' });
  refresh();
  return { ok: true };
}

/**
 * Offer a shift directly to a specific person. Used by employees (their own
 * shift → needs manager approval after acceptance) and managers (any shift →
 * applies as soon as the person accepts).
 */
export async function offerToPerson(shiftId: string, targetProfileId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();
  const isManager = me.role === 'super_admin' || me.role === 'manager';
  if (!targetProfileId) return { ok: false, error: 'Pick who to offer it to.' };

  const { data: myEmps } = await supabase.from('employees').select('id').eq('profile_id', me.id);
  const myEmpIds = (myEmps ?? []).map((e) => e.id);
  const { data: shift } = await supabase.from('shifts').select('id, employee_id, roster_employee_id, location_id, starts_at, status').eq('id', shiftId).maybeSingle();
  if (!shift) return { ok: false, error: 'Shift not found.' };
  const mine = shift.employee_id === me.id || (!!shift.roster_employee_id && myEmpIds.includes(shift.roster_employee_id));
  if (!isManager && !mine) return { ok: false, error: 'That shift isn’t yours.' };
  if (!isManager && shift.status !== 'published') return { ok: false, error: 'You can only offer a published shift.' };
  if (new Date(shift.starts_at).getTime() <= Date.now()) return { ok: false, error: 'That shift has already started.' };
  if (targetProfileId === shift.employee_id) return { ok: false, error: 'They already have this shift.' };

  const { data: full } = await supabase.from('shifts').select('starts_at, ends_at').eq('id', shiftId).single();
  if (full && (await hasConflict(supabase, targetProfileId, full.starts_at, full.ends_at, [shiftId]))) {
    return { ok: false, error: 'That person already works an overlapping shift.' };
  }
  const { data: existing } = await supabase.from('shift_swap_requests').select('id').eq('shift_id', shiftId).eq('status', 'pending').maybeSingle();
  if (existing) return { ok: false, error: 'This shift already has a pending offer or swap.' };

  const giver = shift.employee_id ?? me.id;
  const { error } = await supabase.from('shift_swap_requests').insert({
    shift_id: shiftId,
    target_shift_id: null,
    requested_by: giver,
    requested_to: targetProfileId,
    kind: 'pickup',
    manager_offer: isManager,
    coworker_accepted: false,
    status: 'pending',
    note: (note ?? '').trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  const name = me.display_name || me.full_name || 'A teammate';
  const when = full ? ` (${fmtWhen(full.starts_at, full.ends_at)})` : '';
  await notify([targetProfileId], {
    type: 'swap_request',
    title: 'Shift offered to you',
    body: `${name} offered you a shift${when}. ${isManager ? 'Accept it on your schedule.' : 'Accept it, then a manager approves.'}`,
    link: '/schedule',
  });
  refresh();
  return { ok: true };
}

// --- Blackout days (managers/super admins block dates from time off) ----------

export async function addBlackout(input: { location_id: string; start_date: string; end_date: string; reason: string }): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  if (!input.location_id) return { ok: false, error: 'Pick a store.' };
  if (!input.start_date) return { ok: false, error: 'Pick a date.' };
  const end = input.end_date || input.start_date;
  if (end < input.start_date) return { ok: false, error: 'End date is before the start date.' };
  const { error } = await supabase.from('time_off_blackouts').insert({
    location_id: input.location_id,
    start_date: input.start_date,
    end_date: end,
    reason: input.reason.trim() || null,
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/approvals');
  return { ok: true };
}

export async function removeBlackout(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('time_off_blackouts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/approvals');
  return { ok: true };
}
