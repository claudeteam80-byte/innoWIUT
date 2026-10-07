import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ error: 'VITE_SUPABASE_URL must be a valid URL.' }),
  VITE_SUPABASE_ANON_KEY: z
    .string({ error: 'VITE_SUPABASE_ANON_KEY is required.' })
    .min(20, 'VITE_SUPABASE_ANON_KEY looks too short.'),
});

export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; problems: string[] };

export function parseEnv(source: Record<string, unknown>): EnvResult {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    return { ok: false, problems: result.error.issues.map((issue) => issue.message) };
  }
  return {
    ok: true,
    env: {
      supabaseUrl: result.data.VITE_SUPABASE_URL,
      supabaseAnonKey: result.data.VITE_SUPABASE_ANON_KEY,
    },
  };
}

export function getEnv(): AppEnv {
  const result = parseEnv(import.meta.env);
  if (!result.ok) {
    throw new Error(`Invalid environment: ${result.problems.join(' ')}`);
  }
  return result.env;
}
