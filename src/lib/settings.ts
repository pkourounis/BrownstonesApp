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

/** App-wide settings (singleton), memoized per request. Falls back to defaults. */
export const getAppSettings = cache(async function getAppSettings(): Promise<AppSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('app_settings').select('*').eq('id', true).maybeSingle();
    return (data as AppSettings) ?? DEFAULTS;
  } catch {
    return DEFAULTS;
  }
});
