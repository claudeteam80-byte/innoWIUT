import { supabase } from '@/lib/supabase';

export interface FounderStartupStatus {
  id: string;
  onboarding_completed_at: string | null;
}

export async function fetchFounderStartupStatus(
  userId: string,
): Promise<FounderStartupStatus | null> {
  const { data, error } = await supabase
    .from('startups')
    .select('id, onboarding_completed_at')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const onboardingKeys = {
  all: ['founder-onboarding-status'] as const,
  status: (userId: string | undefined) => [...onboardingKeys.all, userId] as const,
};
