import { supabase } from '@/lib/supabase';

export async function updateOwnProfile(
  userId: string,
  values: { full_name: string; phone: string; linkedin_url: string | null },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(values).eq('id', userId);
  if (error) throw error;
}
