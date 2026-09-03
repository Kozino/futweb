import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True only when a real Supabase project is configured. Otherwise the app
 *  runs in fully-functional Demo Mode backed by localStorage — so designers,
 *  stakeholders and new developers can exercise every screen without secrets. */
export const hasSupabase = Boolean(URL && ANON)

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(URL!, ANON!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'futweb.auth',
      },
      global: { headers: { 'x-application-name': 'futweb' } },
    })
  : null

export const DEMO_MODE = !hasSupabase

if (DEMO_MODE && import.meta.env.DEV) {
  console.info(
    '%c FutWeb — Demo Mode ',
    'background:#E4002B;color:#fff;border-radius:4px;font-weight:600',
    '\nNo VITE_SUPABASE_URL found. Running against the local demo store so every screen works.',
  )
}
