import { Navigate, Outlet } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AccountErrorState } from '@/components/shared/AccountErrorState';
import { FullPageSpinner } from '@/components/shared/FullPageSpinner';
import { onboardingKeys } from '@/features/onboarding/api';
import { useFounderOnboarding } from '@/features/onboarding/useFounderOnboarding';
import { resolveOnboardingAccess, type OnboardingRequirement } from './access';

/**
 * Founder-only gate. With require="complete" founders who have not finished
 * onboarding are sent to it; with require="incomplete" finished founders are
 * sent to their dashboard. Must be nested inside <RequireRole role="founder" />.
 */
export function RequireOnboarding({ require }: { require: OnboardingRequirement }) {
  const onboarding = useFounderOnboarding();
  const queryClient = useQueryClient();
  const decision = resolveOnboardingAccess({ ...onboarding, require });

  switch (decision.kind) {
    case 'loading':
      return <FullPageSpinner />;
    case 'error':
      return (
        <AccountErrorState
          onRetry={() => void queryClient.invalidateQueries({ queryKey: onboardingKeys.all })}
        />
      );
    case 'redirect':
      return <Navigate to={decision.to} replace />;
    case 'allow':
      return <Outlet />;
  }
}
