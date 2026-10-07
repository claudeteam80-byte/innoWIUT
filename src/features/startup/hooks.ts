import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { founderKeys } from '@/features/founder-keys';
import { fetchMyStartup, fetchTeam } from './api';

/** The signed-in founder's startup. The onboarding guard guarantees it exists. */
export function useMyStartup() {
  const { user } = useAuth();
  return useQuery({
    queryKey: founderKeys.startup(user?.id),
    queryFn: async () => {
      const startup = await fetchMyStartup(user?.id as string);
      if (!startup) throw new Error('Startup not found.');
      return startup;
    },
    enabled: Boolean(user),
  });
}

export function useTeam(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.team(startupId ?? ''),
    queryFn: () => fetchTeam(startupId as string),
    enabled: Boolean(startupId),
  });
}
