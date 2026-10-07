import { Navigate } from 'react-router';
import { AccountErrorState } from '@/components/shared/AccountErrorState';
import { FullPageSpinner } from '@/components/shared/FullPageSpinner';
import { useAuth } from '@/features/auth/useAuth';
import { resolveHomeRedirect } from './access';

export function RootRedirect() {
  const { status, profile, profileStatus } = useAuth();
  const decision = resolveHomeRedirect({
    authStatus: status,
    profileStatus,
    role: profile?.role ?? null,
  });

  switch (decision.kind) {
    case 'loading':
      return <FullPageSpinner />;
    case 'error':
      return <AccountErrorState />;
    case 'redirect':
      return <Navigate to={decision.to} replace />;
    case 'allow':
      return null;
  }
}
