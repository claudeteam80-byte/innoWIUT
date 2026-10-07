import { Navigate, Outlet, useLocation } from 'react-router';
import { AccountErrorState } from '@/components/shared/AccountErrorState';
import { FullPageSpinner } from '@/components/shared/FullPageSpinner';
import { useAuth } from '@/features/auth/useAuth';
import type { AppRole } from '@/types/app';
import { resolveRoleAccess } from './access';

/**
 * Lets the child routes render only for a signed-in user with `role`.
 * This is a UX guard; data access is enforced by Supabase RLS.
 */
export function RequireRole({ role }: { role: AppRole }) {
  const { status, profile, profileStatus } = useAuth();
  const location = useLocation();
  const decision = resolveRoleAccess({
    authStatus: status,
    profileStatus,
    role: profile?.role ?? null,
    requiredRole: role,
    location,
  });

  switch (decision.kind) {
    case 'loading':
      return <FullPageSpinner />;
    case 'error':
      return <AccountErrorState />;
    case 'redirect':
      return <Navigate to={decision.to} replace />;
    case 'allow':
      return <Outlet />;
  }
}
