'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, requireRole } from '@/lib/auth';
import { sendPush } from '@/lib/push';
import { revalidatePath } from 'next/cache';

const nowIso = () => new Date().toISOString();

function refresh() {
  revalidatePath('/approvals');
  revalidatePath('/schedule');
  revalidatePath('/dashboard');
}

// --- Manager / super-admin decisions -----------------------------------------

export async function decideTimeOff(id: string, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  // Enforce the 2-per-day cap on approval (SECURITY DEFINER; returns an error string or null).
  const { data: problem, error } = await supabase.rpc('set_timeoff_status', { p_id: id, p_approve: approve });
  if (error) return { ok: false, error: error.message };
  if (problem) return { ok: false, error: problem };

  const { data: req } = await supabase.from('time_off_requests').select('profile_id').eq('id', id).single();
  if (req) {
    await sendPush([req.profile_id], {
      title: `Time off ${approve ? 'approved' : 'declined'}`,
      body: approve ? 'Your time-off request was approved.' : 'Your time-off request was declined — check with your manager.',
      url: '/schedule',
      tag: `timeoff-${id}`,
    });
  }
  refresh();
  return { ok: true };
}

export async function decideAvailability(id: string, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('availability')
    .update({ status: approve ? 'approved' : 'denied', reviewed_by: me.id, reviewed_at: nowIso() })
    .eq('id', id)
    .select('id, profile_id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this request.' };
  await sendPush([data[0].profile_id], {
    title: `Availability ${approve ? 'approved' : 'declined'}`,
    body: approve ? 'Your availability change was approved.' : 'Your availability change was declined.',
    url: '/profile',
    tag: `avail-${id}`,
  });
  refresh();
  return { ok: true };
}

/**
 * Approve or deny a shift drop / swap. On approval:
 *   - if someone claimed it (requested_to set), reassign the shift to them;
 *   - if nobody claimed it, release the shift (make it an open shift).
 */
export async function decideSwap(id: string, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const { data: swap, error: readErr } = await supabase
    .from('shift_swap_requests')
    .select('id, shift_id, requested_by, requested_to')
    .eq('id', id)
    .single();
  if (readErr || !swap) return { ok: false, error: 'Request not found.' };

  if (approve) {
    const { data: shift } = await supabase.from('shifts').select('id, location_id').eq('id', swap.shift_id).single();
    if (shift) {
      if (swap.requested_to) {
        // Reassign to the claimer: link both the profile and (if any) their roster row.
        const { data: emp } = await supabase
          .from('employees')
          .select('id')
          .eq('profile_id', swap.requested_to)
          .eq('location_id', shift.location_id)
          .maybeSingle();
        await supabase.from('shifts').update({ employee_id: swap.requested_to, roster_employee_id: emp?.id ?? null }).eq('id', shift.id);
      } else {
        // Released: becomes an open shift.
        await supabase.from('shifts').update({ employee_id: null, roster_employee_id: null }).eq('id', shift.id);
      }
    }
  }

  const { data, error } = await supabase
    .from('shift_swap_requests')
    .update({ status: approve ? 'approved' : 'denied', reviewed_by: me.id, reviewed_at: nowIso() })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this request.' };

  const targets = [swap.requested_by, swap.requested_to].filter(Boolean) as string[];
  await sendPush(targets, {
    title: `Shift ${approve ? 'approved' : 'declined'}`,
    body: approve
      ? swap.requested_to ? 'The shift is yours — check your schedule.' : 'Your shift was released and is now open.'
      : 'Your shift request was declined.',
    url: '/schedule',
    tag: `swap-${id}`,
  });
  refresh();
  return { ok: true };
}

// --- Employee requests -------------------------------------------------------

export async function requestTimeOff(input: { start_date: string; end_date: string; reason: string }): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
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
  const { data: shift } = await supabase.from('shifts').select('id, employee_id, roster_employee_id').eq('id', shiftId).single();
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
  refresh();
  return { ok: true };
}

/** Claim an open shift someone put up for grabs (awaits manager approval). */
export async function claimShift(swapId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shift_swap_requests')
    .update({ requested_to: me.id })
    .eq('id', swapId)
    .is('requested_to', null)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'This shift was already claimed.' };
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
