import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { ReadinessSection } from '@/domain/readiness';
import type { StageReview } from '@/domain/reviews';

type Functions = Database['public']['Functions'];
export type ReviewQueueRow = Functions['admin_review_queue']['Returns'][number];
export type ReviewStats = Functions['admin_review_stats']['Returns'][number];
export type ReviewDecision = 'approved' | 'needs_work';

// Founders read their own reviews; admins read every review (RLS).
export async function fetchStartupReviews(startupId: string): Promise<StageReview[]> {
  const { data, error } = await supabase
    .from('stage_reviews')
    .select('*')
    .eq('startup_id', startupId)
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** The server checks ownership, completion and that no review is already pending. */
export async function requestStageReview(startupId: string): Promise<StageReview> {
  const { data, error } = await supabase.rpc('request_stage_review', { p_startup_id: startupId });
  if (error) throw error;
  return data;
}

export type ReviewTab = 'pending' | 'needs_work' | 'approved' | 'all';
export type ReviewTypeFilter = '' | 'stage' | 'investor_readiness';
export interface ReviewQueueParams {
  tab: ReviewTab;
  /** '' = every review type. */
  type: ReviewTypeFilter;
  stage: string;
  search: string;
  sort: 'oldest' | 'newest';
  page: number;
}
export const REVIEW_PAGE_SIZE = 25;

export function reviewQueueArgs(params: ReviewQueueParams) {
  return {
    // null (not undefined) means "all statuses"; undefined would fall back to 'pending'.
    p_status: (params.tab === 'all' ? null : params.tab) as string,
    p_stage: params.stage || undefined,
    p_type: params.type || undefined,
    p_search: params.search.trim() || undefined,
    p_sort: params.sort,
    p_limit: REVIEW_PAGE_SIZE,
    p_offset: Math.max(0, params.page - 1) * REVIEW_PAGE_SIZE,
  };
}

export async function fetchReviewQueue(
  params: ReviewQueueParams,
): Promise<{ rows: ReviewQueueRow[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_review_queue', reviewQueueArgs(params));
  if (error) throw error;
  return { rows: data, total: Number(data[0]?.total_count ?? 0) };
}

export async function fetchReviewStats(): Promise<ReviewStats> {
  const { data, error } = await supabase.rpc('admin_review_stats');
  if (error) throw error;
  return data[0] ?? { pending_reviews: 0, waiting_over_3_days: 0 };
}

export async function fetchReview(id: string) {
  const { data, error } = await supabase
    .from('stage_reviews')
    .select(
      '*, startup:startups(id, name, tagline, logo_path, journey_stage, owner:profiles(id, full_name, email))',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export type ReviewWithStartup = NonNullable<Awaited<ReturnType<typeof fetchReview>>>;

export async function decideReview(input: {
  reviewId: string;
  decision: ReviewDecision;
  feedback?: string | null;
  adminNote?: string | null;
  requirementIds?: string[];
  /** Investor Readiness only: sections that need work. */
  sections?: ReadinessSection[];
}): Promise<StageReview> {
  const { data, error } = await supabase.rpc('decide_stage_review', {
    p_review_id: input.reviewId,
    p_decision: input.decision,
    p_feedback: input.feedback ?? undefined,
    p_admin_note: input.adminNote ?? undefined,
    p_requirement_ids: input.requirementIds ?? [],
    p_sections: input.sections ?? [],
  });
  if (error) throw error;
  return data;
}
