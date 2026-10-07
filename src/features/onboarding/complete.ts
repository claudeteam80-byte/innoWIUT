import { supabase } from '@/lib/supabase';
import type { OnboardingPayload } from './schemas';

/** Runs public.complete_onboarding() — one transaction on the server. Returns the startup id. */
export async function completeOnboarding(payload: OnboardingPayload): Promise<string> {
  const { data, error } = await supabase.rpc('complete_onboarding', { payload });
  if (error) throw error;
  return data;
}

export async function setStartupLogo(startupId: string, logoPath: string): Promise<void> {
  const { error } = await supabase
    .from('startups')
    .update({ logo_path: logoPath })
    .eq('id', startupId);
  if (error) throw error;
}
