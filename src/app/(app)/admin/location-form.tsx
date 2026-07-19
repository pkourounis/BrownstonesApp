'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Location } from '@/lib/database.types';
import { createLocation, updateLocation, saveStaffingRules } from './actions';
import { StaffingGrid, defaultRows, rowsToInput, type StaffingRow, type CopySource } from './staffing-grid';

const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

export function LocationForm({ location, staffingSources }: { location: Location | null; staffingSources?: CopySource[] }) {
  const router = useRouter();
  const editing = !!location;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // New locations fill their staffing chart inline (all roles default to 0).
  const [staffRows, setStaffRows] = useState<StaffingRow[]>(() => defaultRows());

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = editing ? await updateLocation(location!.id, fd) : await createLocation(fd);
      if (res.ok) {
        const newId = (res as { id?: string }).id;
        if (!editing && newId) {
          await saveStaffingRules(newId, rowsToInput(staffRows));
        }
        router.push('/admin');
        router.refresh();
      } else {
        setError(res.error ?? 'Could not save.');
      }
    });
  };

  const F = ({ label, name, defaultValue, type = 'text', placeholder }: { label: string; name: string; defaultValue?: string | number | null; type?: string; placeholder?: string }) => (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} defaultValue={defaultValue ?? ''} placeholder={placeholder} className="input" step={type === 'number' ? 'any' : undefined} min={type === 'number' ? '0' : undefined} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Basics</h2>
        <F label="Location name" name="name" defaultValue={location?.name} placeholder="Amityville" />
        <div className="grid grid-cols-2 gap-3">
          <F label="Store number" name="location_number" defaultValue={location?.location_number} placeholder="001" />
          <F label="URL slug" name="slug" defaultValue={location?.slug} placeholder="amityville" />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Address & contact</h2>
        <F label="Street address" name="address" defaultValue={location?.address} placeholder="123 Merrick Rd" />
        <div className="grid grid-cols-2 gap-3">
          <F label="City" name="city" defaultValue={location?.city} placeholder="Amityville" />
          <F label="State" name="state" defaultValue={location?.state} placeholder="NY" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="ZIP" name="postal_code" defaultValue={location?.postal_code} placeholder="11701" />
          <F label="Phone" name="phone" type="tel" defaultValue={location?.phone} placeholder="(631) 555-0123" />
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Operations</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Time zone</label>
            <select name="timezone" defaultValue={location?.timezone ?? 'America/New_York'} className="input">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace('America/', '')}</option>
              ))}
            </select>
          </div>
          <F label="Opens at" name="opens_at" type="time" defaultValue={location?.opens_at?.slice(0, 5)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Seats" name="seats" type="number" defaultValue={location?.seats} />
          <F label="Tables" name="tables" type="number" defaultValue={location?.tables} />
        </div>
        <F label="Sales / hour per server ($)" name="revenue_per_hour_target" type="number" defaultValue={location?.revenue_per_hour_target ?? 1300} />
        <p className="-mt-2 text-xs text-brand-500">How much in sales one server handles per hour (default $1,300). The staffing rules below are the floor; when a day&apos;s projected peak-hour sales exceed this per server, the builder flags that extra staff are needed for the rush.</p>
        <F label="Daily sales goal ($)" name="daily_sales_goal" type="number" defaultValue={location?.daily_sales_goal} placeholder="e.g. 12000" />
        <p className="-mt-2 text-xs text-brand-500">When this store&apos;s net sales for the day reach this goal, it&apos;s celebrated on the home screen for managers and super admins. Leave blank for no goal.</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Scheduling</h2>
        <p className="-mt-2 text-xs text-brand-500">Used by Auto-fill and the staffing guide for this store.</p>
        <div className="grid grid-cols-3 gap-3">
          <F label="Sales / labor-hr ($)" name="labor_target_splh" type="number" defaultValue={location?.labor_target_splh ?? 130} />
          <F label="Weekly cap (h)" name="weekly_hour_cap" type="number" defaultValue={location?.weekly_hour_cap ?? 40} />
          <F label="Shift length (h)" name="shift_length" type="number" defaultValue={location?.shift_length ?? 6} />
        </div>
        <ul className="space-y-1 text-xs text-brand-500">
          <li><span className="font-semibold text-brand-700">Sales / labor-hr</span> — target sales each staffed hour should bring in. Auto-fill divides demand by this to decide headcount; <em>higher = leaner staffing</em>.</li>
          <li><span className="font-semibold text-brand-700">Weekly cap</span> — the most hours Auto-fill will give one person in a week (keeps people under overtime).</li>
          <li><span className="font-semibold text-brand-700">Shift length</span> — the default shift block Auto-fill lays down (a 30-min break is added at 6h+).</li>
        </ul>
        <div>
          <label className="label">Staffing notes</label>
          <textarea name="staffing_notes" defaultValue={location?.staffing_notes ?? ''} rows={3} placeholder="e.g. 1 server opens at 7am every day. Manager off Tuesdays. Lead Server covers when manager is off." className="input" />
          <p className="mt-1 text-xs text-brand-500">Rules that aren&apos;t a simple headcount (opener, manager days off, lead-server coverage). Shown to schedulers on the builder.</p>
        </div>
      </div>

      {!editing && (
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold text-brand-900">Staffing rules</h2>
            <p className="text-xs text-brand-500">How many of each role this store needs each day. All start at 0 — fill in what applies, or copy another store&apos;s chart as a starting point.</p>
          </div>
          <StaffingGrid rows={staffRows} setRows={setStaffRows} sources={staffingSources} />
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Reviews</h2>
        <F label="Yelp page URL" name="yelp_url" defaultValue={location?.yelp_url} placeholder="https://www.yelp.com/biz/…" />
        <p className="-mt-2 text-xs text-brand-500">Paste this store&apos;s Yelp page link. Its rating &amp; recent reviews show on the Reviews page and Home. (Requires the Yelp API key in Netlify.)</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Toast integration</h2>
        <F label="Toast restaurant GUID" name="toast_guid" defaultValue={location?.toast_guid} placeholder="Optional — links sales & labor sync" />
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_active" defaultChecked={location ? location.is_active : true} className="h-4 w-4 accent-brand-700" />
          <span className="text-sm font-medium text-brand-900">Active</span>
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? <Loader2 className="animate-spin" size={18} /> : editing ? 'Save location' : 'Add location'}
      </button>
    </form>
  );
}
