import { paths } from '@/app/paths';
import { withReturnTo } from '@/features/auth/return-to';
import type { AppRole } from '@/types/app';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in';
export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

export type AccessDecision =
  { kind: 'loading' } | { kind: 'allow' } | { kind: 'redirect'; to: string } | { kind: 'error' };

export const ROLE_HOME: Record<AppRole, string> = {
  founder: paths.founder.dashboard,
  admin: paths.admin.dashboard,
  superadmin: paths.admin.dashboard,
};

export const ROLE_LOGIN: Record<AppRole, string> = {
  founder: paths.founderLogin,
  admin: paths.adminLogin,
  superadmin: paths.adminLogin,
};

export const ROLE_AREA: Record<AppRole, string> = {
  founder: paths.founder.root,
  admin: paths.admin.root,
  superadmin: paths.admin.root,
};

/** Admins and superadmins share the admin area. */
export function isAdminRole(role: AppRole | null | undefined): boolean {
  return role === 'admin' || role === 'superadmin';
}

/**
 * Whether `role` may enter an area that requires `required`:
 * founder → founders only; admin → admins and superadmins; superadmin → superadmins only.
 */
export function roleSatisfies(role: AppRole, required: AppRole): boolean {
  if (required === 'admin') return isAdminRole(role);
  return role === required;
}

interface SessionInput {
  authStatus: AuthStatus;
  profileStatus: ProfileStatus;
  role: AppRole | null;
}

/** Access to an area that requires a signed-in user with a specific role. */
export function resolveRoleAccess(
  input: SessionInput & { requiredRole: AppRole; location: { pathname: string; search: string } },
): AccessDecision {
  const { authStatus, profileStatus, role, requiredRole, location } = input;

  if (authStatus === 'loading') return { kind: 'loading' };
  if (authStatus === 'signed_out') {
    return {
      kind: 'redirect',
      to: withReturnTo(ROLE_LOGIN[requiredRole], `${location.pathname}${location.search}`),
    };
  }
  if (profileStatus === 'idle' || profileStatus === 'loading') return { kind: 'loading' };
  if (profileStatus === 'error' || !role) return { kind: 'error' };
  if (!roleSatisfies(role, requiredRole)) return { kind: 'redirect', to: ROLE_HOME[role] };
  return { kind: 'allow' };
}

/** Where `/` should send someone. */
export function resolveHomeRedirect(input: SessionInput): AccessDecision {
  const { authStatus, profileStatus, role } = input;
  if (authStatus === 'loading') return { kind: 'loading' };
  if (authStatus === 'signed_out') return { kind: 'redirect', to: paths.authChoice };
  if (profileStatus === 'idle' || profileStatus === 'loading') return { kind: 'loading' };
  if (profileStatus === 'error' || !role) return { kind: 'error' };
  return { kind: 'redirect', to: ROLE_HOME[role] };
}

export type OnboardingRequirement = 'complete' | 'incomplete';

/**
 * Founder onboarding gate. 'complete' guards the founder workspace; 'incomplete'
 * guards the onboarding flow itself so finished founders cannot re-enter it.
 */
export function resolveOnboardingAccess(input: {
  status: 'loading' | 'error' | 'ready';
  completed: boolean;
  require: OnboardingRequirement;
}): AccessDecision {
  if (input.status === 'loading') return { kind: 'loading' };
  if (input.status === 'error') return { kind: 'error' };
  if (input.require === 'complete' && !input.completed) {
    return { kind: 'redirect', to: paths.founder.onboarding };
  }
  if (input.require === 'incomplete' && input.completed) {
    return { kind: 'redirect', to: paths.founder.dashboard };
  }
  return { kind: 'allow' };
}

/** For login/signup pages: where an already signed-in user should go instead. */
export function resolveSignedInRedirect(input: SessionInput): string | null {
  if (input.authStatus !== 'signed_in' || input.profileStatus !== 'ready' || !input.role) {
    return null;
  }
  return ROLE_HOME[input.role];
}
