import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Only PUBLIC values are used here (from .env / Vercel environment variables).
// The publishable key is safe in the browser: the database's security rules
// only allow the logged-in owner to read or change anything.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
