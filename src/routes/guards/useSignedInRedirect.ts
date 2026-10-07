import { useAuth } from '@/features/auth/useAuth';
import { resolveSignedInRedirect } from './access';

/**
 * For login/signup pages: the home path of an already signed-in user, or null.
 * Pass enabled=false while the page is handling its own sign-in so it can run
 * role checks before anyone is redirected.
 */
export function useSignedInRedirect(enabled: boolean): string | null {
  const { status, profile, profileStatus } = useAuth();
  if (!enabled) return null;
  return resolveSignedInRedirect({
    authStatus: status,
    profileStatus,
    role: profile?.role ?? null,
  });
}
