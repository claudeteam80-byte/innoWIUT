import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { fetchFounderStartupStatus, onboardingKeys } from './api';

export interface FounderOnboardingState {
  status: 'loading' | 'error' | 'ready';
  completed: boolean;
  startupId: string | null;
}

export function useFounderOnboarding(): FounderOnboardingState {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: onboardingKeys.status(user?.id),
    queryFn: () => fetchFounderStartupStatus(user?.id as string),
    enabled: Boolean(user),
  });

  if (query.isPending) return { status: 'loading', completed: false, startupId: null };
  if (query.isError) return { status: 'error', completed: false, startupId: null };
  return {
    status: 'ready',
    completed: Boolean(query.data?.onboarding_completed_at),
    startupId: query.data?.id ?? null,
  };
}
