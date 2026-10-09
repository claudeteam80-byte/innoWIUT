import { supabase } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import type { StageEvidence, StageRequirement } from '@/domain/journey';
import { removeFile } from '@/lib/storage';

// Used by founders (own startup) and admins (read-only); RLS decides what each one sees.

export async function fetchRequirements(startupId: string): Promise<StageRequirement[]> {
  const { data, error } = await supabase
    .from('startup_stage_requirements')
    .select('*')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchEvidence(startupId: string): Promise<StageEvidence[]> {
  const { data, error } = await supabase
    .from('stage_evidence')
    .select('*')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export type RequirementPatch = Pick<
  TablesUpdate<'startup_stage_requirements'>,
  'status' | 'progress_value' | 'linked_metric_id'
>;

export async function updateRequirement(id: string, patch: RequirementPatch): Promise<void> {
  const { error } = await supabase.from('startup_stage_requirements').update(patch).eq('id', id);
  if (error) throw error;
}

export interface TractionChoice {
  key: string;
  title: string;
  metricId: string | null;
}

/** Adds and removes the founder's chosen traction requirements in one go. */
export async function saveTractionChoices(
  startupId: string,
  existing: readonly StageRequirement[],
  choices: readonly TractionChoice[],
): Promise<void> {
  const keep = new Set(choices.map((c) => c.key));
  const removed = existing.filter(
    (row) => row.stage === 'traction' && !keep.has(row.requirement_key),
  );
  if (removed.length) {
    const { error } = await supabase
      .from('startup_stage_requirements')
      .delete()
      .in(
        'id',
        removed.map((row) => row.id),
      );
    if (error) throw error;
  }
  for (const choice of choices) {
    const row = existing.find((r) => r.stage === 'traction' && r.requirement_key === choice.key);
    if (row) {
      if (row.linked_metric_id !== choice.metricId) {
        await updateRequirement(row.id, { linked_metric_id: choice.metricId });
      }
      continue;
    }
    const { error } = await supabase.from('startup_stage_requirements').insert({
      startup_id: startupId,
      stage: 'traction',
      requirement_key: choice.key,
      title: choice.title,
      linked_metric_id: choice.metricId,
    });
    if (error) throw error;
  }
}

export type EvidenceInsert = Pick<
  TablesInsert<'stage_evidence'>,
  | 'requirement_id'
  | 'update_id'
  | 'stage'
  | 'evidence_type'
  | 'label'
  | 'text_value'
  | 'url'
  | 'file_path'
  | 'linked_metric_id'
>;

export async function addEvidence(startupId: string, rows: EvidenceInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('stage_evidence').insert(
    rows.map((row) => ({ ...row, startup_id: startupId })),
    { defaultToNull: false },
  );
  if (error) throw error;
}

/** Deletes evidence rows and then their files (a leftover file is harmless; a dangling row is not). */
export async function deleteEvidence(items: readonly Pick<StageEvidence, 'id' | 'file_path'>[]) {
  if (items.length === 0) return;
  const { error } = await supabase
    .from('stage_evidence')
    .delete()
    .in(
      'id',
      items.map((item) => item.id),
    );
  if (error) throw error;
  await Promise.all(items.map((item) => removeFile('update-attachments', item.file_path)));
}
