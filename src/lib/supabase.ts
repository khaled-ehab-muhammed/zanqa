import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configMissing = !url || !key || url.includes('YOUR-PROJECT') || key.startsWith('your-');

// Only the public anon key is used here. The service-role key must never appear in frontend code.
// PKCE: email links come back as "?code=..." (query string), so they do not clash with the "#/room/XXXXXX" hash routes.
export const supabase: SupabaseClient = configMissing
  ? (null as unknown as SupabaseClient)
  : createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
