/** Message for toasts from Supabase/Postgres errors without leaking internals. */
export function errorMessage(error: unknown, fallback: string): string {
  const candidate = error as { code?: string; message?: string } | null;
  if (candidate?.message && (candidate.code === '22023' || candidate.code === 'P0001'))
    return candidate.message;
  if (candidate?.message?.toLowerCase().includes('failed to fetch')) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (error instanceof Error && error.message && !('code' in error)) return error.message;
  return fallback;
}
