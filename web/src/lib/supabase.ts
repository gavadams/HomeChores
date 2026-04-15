import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // The app can still render with local demo data while env vars are missing.
  // Runtime data calls should gate on these values before requesting Supabase.
  console.warn('Supabase environment variables are not set.')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
