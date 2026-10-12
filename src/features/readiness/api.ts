import { supabase } from '@/lib/supabase';
import type { Database, TablesUpdate } from '@/types/database';
import type {
  InterviewStatus,
  ReadinessInterview,
  ReadinessProfile,
  ReadinessRequirement,
  ReadinessSection,
  ReadinessStateRow,
} from '@/domain/readiness';
import type { StageReview } from '@/domain/reviews';

// Founders read and edit their own readiness data while in Investor Readiness; admins read
// every startup's (RLS). Completion is always computed by the database.

export async function fetchReadinessState(startupId: string): Promise<ReadinessStateRow[]> {
  const { data, error } = await supabase.rpc('investor_readiness_state', {
    p_startup_id: startupId,
  });
  if (error) throw error;
  return data;
}

export async function fetchReadinessRequirements(
  startupId: string,
): Promise<ReadinessRequirement[]> {
  const { data, error } = await supabase
    .from('investor_readiness_requirements')
    .select('*')
    .eq('startup_id', startupId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchReadinessProfile(startupId: string): Promise<ReadinessProfile | null> {
  const { data, error } = await supabase
    .from('investor_readiness_profiles')
    .select('*')
    .eq('startup_id', startupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Ids of the traction metrics chosen as primary investor metrics (links, never copies). */
export async function fetchReadinessMetrics(startupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('investor_readiness_metrics')
    .select('metric_id')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((row) => row.metric_id);
}

/** The founder-visible interview (the admin note is not readable by founders). */
export async function fetchInterview(startupId: string): Promise<ReadinessInterview | null> {
  const { data, error } = await supabase
    .from('readiness_interviews')
    .select('id, startup_id, status, scheduled_at, location_or_link, completed_at')
    .eq('startup_id', startupId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type RequirementPatch = Pick<
  TablesUpdate<'investor_readiness_requirements'>,
  'text_value' | 'url' | 'linked_existing_evidence_id' | 'not_applicable' | 'not_applicable_reason'
>;

export async function updateReadinessRequirement(id: string, patch: RequirementPatch) {
  const { error } = await supabase
    .from('investor_readiness_requirements')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export type ProfilePatch = Omit<
  TablesUpdate<'investor_readiness_profiles'>,
  'startup_id' | 'created_at' | 'updated_at'
>;

export async function updateReadinessProfile(startupId: string, patch: ProfilePatch) {
  const { error } = await supabase
    .from('investor_readiness_profiles')
    .update(patch)
    .eq('startup_id', startupId);
  if (error) throw error;
}

/** Sets the primary investor metrics to exactly these traction metric ids (max 5). */
export async function savePrimaryMetrics(
  startupId: string,
  existing: readonly string[],
  next: readonly string[],
) {
  const removed = existing.filter((id) => !next.includes(id));
  const added = next.filter((id) => !existing.includes(id));
  if (removed.length) {
    const { error } = await supabase
      .from('investor_readiness_metrics')
      .delete()
      .eq('startup_id', startupId)
      .in('metric_id', removed);
    if (error) throw error;
  }
  if (added.length) {
    const { error } = await supabase
      .from('investor_readiness_metrics')
      .insert(added.map((metric_id) => ({ startup_id: startupId, metric_id })));
    if (error) throw error;
  }
}

/** The server checks the stage, completion and that no review is pending. */
export async function requestReadinessReview(startupId: string): Promise<StageReview> {
  const { data, error } = await supabase.rpc('request_investor_readiness_review', {
    p_startup_id: startupId,
  });
  if (error) throw error;
  return data;
}

// ---- Admin -----------------------------------------------------------------------------

type Functions = Database['public']['Functions'];
export type ReadinessStats = Functions['admin_readiness_stats']['Returns'][number];
export type AdminInterview = Functions['admin_readiness_interview']['Returns'][number];

export async function fetchReadinessStats(): Promise<ReadinessStats> {
  const { data, error } = await supabase.rpc('admin_readiness_stats');
  if (error) throw error;
  return (
    data[0] ?? {
      startups_in_readiness: 0,
      pending_readiness_reviews: 0,
      investor_ready_startups: 0,
    }
  );
}

export async function fetchAdminInterview(startupId: string): Promise<AdminInterview | null> {
  const { data, error } = await supabase.rpc('admin_readiness_interview', {
    p_startup_id: startupId,
  });
  if (error) throw error;
  return data[0] ?? null;
}

export async function setInterview(input: {
  startupId: string;
  status: InterviewStatus;
  scheduledAt?: string | null;
  locationOrLink?: string | null;
  adminNote?: string | null;
}) {
  const { data, error } = await supabase.rpc('admin_set_readiness_interview', {
    p_startup_id: input.startupId,
    p_status: input.status,
    p_scheduled_at: input.scheduledAt ?? undefined,
    p_location_or_link: input.locationOrLink ?? undefined,
    p_admin_note: input.adminNote ?? undefined,
  });
  if (error) throw error;
  return data;
}

export type { ReadinessSection };
