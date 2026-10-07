import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';
import { localToday } from '@/domain/form-fields';
import type { buildUpdateRow } from './schemas';

export type StartupUpdate = Tables<'startup_updates'>;
type UpdateRow = ReturnType<typeof buildUpdateRow> & { image_path: string | null };

export async function fetchUpdates(startupId: string): Promise<StartupUpdate[]> {
  const { data, error } = await supabase
    .from('startup_updates')
    .select('*')
    .eq('startup_id', startupId)
    .order('update_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createUpdate(startupId: string, row: UpdateRow): Promise<StartupUpdate> {
  const { data, error } = await supabase
    .from('startup_updates')
    .insert({ ...row, startup_id: startupId, update_date: localToday() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function editUpdate(id: string, row: UpdateRow): Promise<StartupUpdate> {
  const values: TablesUpdate<'startup_updates'> = { ...row };
  // Publishing dates the update on the day it goes out.
  if (row.status === 'published') values.update_date = localToday();
  const { data, error } = await supabase
    .from('startup_updates')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function publishDraft(id: string): Promise<void> {
  const { error } = await supabase
    .from('startup_updates')
    .update({ status: 'published', update_date: localToday() })
    .eq('id', id)
    .eq('status', 'draft');
  if (error) throw error;
}

/** RLS only allows deleting drafts; returns false if nothing was deleted. */
export async function deleteDraft(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('startup_updates')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')
    .select('id');
  if (error) throw error;
  return data.length > 0;
}
