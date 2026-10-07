import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';
import type { TeamMemberOutput } from './schemas';

export type Startup = Tables<'startups'>;
export type TeamMember = Tables<'team_members'>;

export async function fetchMyStartup(userId: string): Promise<Startup | null> {
  const { data, error } = await supabase
    .from('startups')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateStartup(
  startupId: string,
  values: TablesUpdate<'startups'>,
): Promise<Startup> {
  const { data, error } = await supabase
    .from('startups')
    .update(values)
    .eq('id', startupId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTeam(startupId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveTeamMember(
  startupId: string,
  values: TeamMemberOutput,
  id?: string,
): Promise<void> {
  const { error } = id
    ? await supabase.from('team_members').update(values).eq('id', id)
    : await supabase.from('team_members').insert({ ...values, startup_id: startupId });
  if (error) throw error;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw error;
}
