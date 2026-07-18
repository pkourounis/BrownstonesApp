import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  ArrowRight,
  BarChart3,
  CalendarPlus,
  UsersRound,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CircleDot,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, canManage } from '@/lib/auth';
import { money, moneyShort, shiftDay, shiftTimeRange } from '@/lib/format';
import type { Shift, Availability } from '@/lib/database.types';
import { SyncButton } from '../insights/sync-button';

export const dynamic = 'force-dynamic';

type Store = { id: string; name: string; net: number; labor_pct: number; on_now: number };
type Summary = {
  date: string;
  is_today: boolean;
  net: number;
  net_prev: number;
  labor_cost: number;
  labor_pct: number;
  on_now: number;
  synced_at: string | null;
  stores: Store[];
};

const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '—';

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = (profile.display_name || profile.full_name || 'there').split(' ')[0];
  const manager = canManage(profile.role);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Hi, {firstName} 👋</h1>
          <p className="text-sm text-brand-600">
            {manager ? "Here's how the business is doing." : "Here's what's coming up."}
          </p>
        </div>
        {manager && <SyncButton />}
      </div>

      {manager ? <OpsHome /> : <EmployeeHome profileId={profile.id} />}
    </div>
  );
}

async function OpsHome() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('home_summary');
  const s = (data ?? null) as Summary | null;
  if (!s) return <div className="card text-center text-sm text-brand-500">No data yet.</div>;

  const delta = s.net_prev > 0 ? Math.round(((s.net - s.net_prev) / s.net_prev) * 100) : null;
  const laborTone = s.labor_pct > 0 && s.labor_pct <= 30 ? 'text-green-700' : s.labor_pct > 30 ? 'text-brick-600' : 'text-brand-400';
  const dayLabel = s.is_today ? 'Today' : new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(s.date + 'T12:00:00'));

  const attention: string[] = [];
  for (const st of s.stores) {
    if (st.net > 0 && st.labor_pct > 32) attention.push(`${st.name} labor is high at ${st.labor_pct}%.`);
    if (st.net === 0) attention.push(`${st.name} has no sales synced ${s.is_today ? 'yet today' : 'for this day'}.`);
  }

  return (
    <>
      {/* Hero */}
      <div className="card bg-brand-700 text-white">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-200">Net sales · {dayLabel}</p>
          {delta != null && (
            <span className="flex items-center gap-1 text-xs font-medium text-gold-200">
              {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {Math.abs(delta)}% vs prior day
            </span>
          )}
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">{money(s.net)}</p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="text-gold-100">
            Labor <span className={`font-bold ${s.labor_pct <= 30 ? 'text-white' : 'text-gold-200'}`}>{s.labor_pct > 0 ? `${s.labor_pct}%` : '—'}</span>
          </span>
          <span className="flex items-center gap-1 text-gold-100">
            <CircleDot size={13} className="text-green-300" /> {s.on_now} on the clock
          </span>
        </div>
        <p className="mt-2 text-[11px] text-gold-200/80">As of {fmtTime(s.synced_at)} · live from Toast</p>
      </div>

      {/* Per-store snapshot */}
      {s.stores.length > 1 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-brand-900">By store</h2>
            <Link href="/insights" className="flex items-center gap-1 text-sm font-medium text-brand-700">
              Insights <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="space-y-2">
            {s.stores.map((st) => (
              <li key={st.id} className="card flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-brand-900">{st.name}</p>
                  <p className="text-xs text-brand-500">
                    {st.on_now} on now · labor{' '}
                    <span className={st.net > 0 && st.labor_pct > 30 ? 'font-semibold text-brick-600' : 'text-brand-600'}>
                      {st.net > 0 ? `${st.labor_pct}%` : '—'}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 text-right font-bold tabular-nums text-brand-900">{moneyShort(st.net)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Needs attention */}
      {attention.length > 0 && (
        <section className="card border-l-4 border-l-gold-400">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900">
            <AlertTriangle size={16} className="text-gold-500" /> Needs attention
          </h2>
          <ul className="space-y-1.5">
            {attention.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-brand-700">
                <span className="text-gold-500">•</span> {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 font-semibold text-brand-900">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction href="/insights" icon={<BarChart3 size={20} />} label="Insights" />
          <QuickAction href="/schedule/build" icon={<CalendarPlus size={20} />} label="Build schedule" />
          <QuickAction href="/schedule/staffing" icon={<TrendingUp size={20} />} label="Staffing needs" />
          <QuickAction href="/roster" icon={<UsersRound size={20} />} label="Roster" />
        </div>
      </section>
    </>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card flex items-center gap-3 py-3 hover:border-brand-300">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">{icon}</span>
      <span className="font-medium text-brand-900">{label}</span>
    </Link>
  );
}

async function EmployeeHome({ profileId }: { profileId: string }) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: myShifts }, { data: avail }] = await Promise.all([
    supabase.from('shifts').select('*').eq('employee_id', profileId).gte('ends_at', nowIso).order('starts_at').limit(3),
    supabase.from('availability').select('*').eq('profile_id', profileId),
  ]);
  const shifts = (myShifts as Shift[]) ?? [];
  const availability = (avail as Availability[]) ?? [];
  const availStatus = availability.length
    ? availability.some((a) => a.status === 'pending')
      ? { text: 'Pending approval', cls: 'bg-amber-100 text-amber-700' }
      : availability.some((a) => a.status === 'denied')
        ? { text: 'Needs changes', cls: 'bg-brick-500/15 text-brick-600' }
        : { text: 'Approved', cls: 'bg-green-100 text-green-700' }
    : null;

  return (
    <>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Your next shifts</h2>
          <Link href="/schedule" className="flex items-center gap-1 text-sm font-medium text-brand-700">
            Full schedule <ArrowRight size={14} />
          </Link>
        </div>
        {shifts.length > 0 ? (
          <ul className="space-y-3">
            {shifts.map((s) => (
              <li key={s.id} className="card flex items-center gap-4">
                <div className="flex flex-col items-center rounded-xl bg-brand-700 px-3 py-2 text-white">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-brand-900">{shiftDay(s.starts_at)}</p>
                  <p className="flex items-center gap-1 text-sm text-brand-600">
                    <Clock size={14} /> {shiftTimeRange(s.starts_at, s.ends_at)}
                  </p>
                </div>
                {s.status === 'draft' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Draft</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="card text-center text-sm text-brand-500">No upcoming shifts scheduled yet.</div>
        )}
      </section>

      <Link href="/profile" className="card flex items-center justify-between">
        <div>
          <p className="font-semibold text-brand-900">My availability</p>
          <p className="text-sm text-brand-500">Set the days &amp; hours you can work</p>
        </div>
        {availStatus ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${availStatus.cls}`}>{availStatus.text}</span>
        ) : (
          <span className="flex items-center gap-1 text-sm font-medium text-brand-700">Set it <ArrowRight size={14} /></span>
        )}
      </Link>
    </>
  );
}
