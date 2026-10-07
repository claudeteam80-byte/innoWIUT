import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getEnv } from './env';

const env = getEnv();

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
