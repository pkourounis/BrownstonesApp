import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { AppSettings } from '@/lib/database.types';

const DEFAULTS: AppSettings = {
  id: true,
  logo_url: null,
  splash_url: null,
  primary_color: null,
  labor_target_splh: 75,
  weekly_hour_cap: 40,
  shift_length: 6,
  updated_by: null,
  updated_at: new Date(0).toISOString(),
};

// App settings are a global singleton that changes rarely, yet the layout reads
// them on every page load. Cache the value in-memory for a short window so most
// navigations skip the query entirely. (Per-request React cache() still dedupes
// within a single render; this adds cross-request reuse on a warm instance.)
let _cache: { at: number; val: AppSettings } | null = null;
const TTL_MS = 60_000;

/** App-wide settings (singleton). Memoized per request and cached ~60s across requests. */
export const getAppSettings = cache(async function getAppSettings(): Promise<AppSettings> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.val;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('app_settings').select('*').eq('id', true).maybeSingle();
    const val = (data as AppSettings) ?? DEFAULTS;
    _cache = { at: Date.now(), val };
    return val;
  } catch {
    return _cache?.val ?? DEFAULTS;
  }
});

/** Clear the in-memory settings cache (call after an admin settings update). */
export function invalidateAppSettings() {
  _cache = null;
}
