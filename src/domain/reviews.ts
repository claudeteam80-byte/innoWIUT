// Stage Review (V2.2): the founder-facing review state of a stage and the next best action
// it implies. Pure functions so founder, admin and tests share the same rules.
//
// Stored review statuses are pending / needs_work / approved (public.stage_reviews).
// not_ready and ready are derived from requirement progress. Only an approved review moves
// a startup; nothing here changes a stage.
import type { Enums, Tables } from '@/types/database';
import {
  journeySummary,
  stageName,
  type StageEvidence,
  type StageKey,
  type StageProgress,
  type StageRequirement,
} from './journey';

export type StageReview = Tables<'stage_reviews'>;
export type ReviewType = Enums<'review_type'>;
export type ReviewState = 'not_ready' | 'ready' | 'pending' | 'needs_work' | 'approved';

export const REVIEW_STATE_META: Record<ReviewState, { label: string; className: string }> = {
  not_ready: { label: 'Not Ready', className: 'bg-canvas text-muted' },
  ready: { label: 'Ready', className: 'bg-primary-soft text-primary' },
  pending: { label: 'Pending Review', className: 'bg-warning-soft text-warning-strong' },
  needs_work: { label: 'Needs Work', className: 'bg-danger-soft text-danger-strong' },
  approved: { label: 'Approved', className: 'bg-success-soft text-success' },
};

/** How long the "Stage approved" state stays up after approval (if no new progress). */
export const APPROVED_STATE_DAYS = 14;

/** Stage an approved review moves to. Investor Access is reached only via Investor Readiness. */
const REVIEW_NEXT: Partial<Record<StageKey, StageKey>> = {
  idea: 'validation',
  validation: 'mvp',
  mvp: 'traction',
  traction: 'investor_readiness',
  investor_readiness: 'investor_access',
};

/** Next stage a review would move to, or null when the stage cannot be reviewed. */
export function nextReviewStage(stage: StageKey): StageKey | null {
  return REVIEW_NEXT[stage] ?? null;
}

/** Founder- and admin-facing label of a review state; an approved readiness review is "Investor Ready". */
export function reviewStateLabel(state: ReviewState, type: ReviewType = 'stage'): string {
  return state === 'approved' && type === 'investor_readiness'
    ? 'Investor Ready'
    : REVIEW_STATE_META[state].label;
}

export const canRequestReview = (stage: StageKey) => nextReviewStage(stage) !== null;

const newestFirst = (a: StageReview, b: StageReview) =>
  b.requested_at.localeCompare(a.requested_at) || b.id.localeCompare(a.id);

/** Reviews of one stage, newest first. */
export function reviewsOfStage(reviews: readonly StageReview[], stage: StageKey): StageReview[] {
  return reviews.filter((r) => r.from_stage === stage).sort(newestFirst);
}

/** Every review, newest first (history). */
export function reviewHistory(reviews: readonly StageReview[]): StageReview[] {
  return [...reviews].sort(newestFirst);
}

export interface StageReviewInfo {
  state: ReviewState;
  /** The review the state is about (pending, needs work or the approval), if any. */
  review: StageReview | null;
  /** Stage a successful review moves to (null for Traction). */
  nextStage: StageKey | null;
  /** Needs work: the founder changed something since the decision. */
  improvedSinceFeedback: boolean;
}

/**
 * The review state of the startup's CURRENT stage. Deterministic for the same input:
 *   pending review → pending
 *   latest review of this stage needs work → needs_work
 *   recently approved into this stage, no progress yet → approved
 *   every required requirement completed and the next stage is open → ready
 *   otherwise → not_ready
 */
export function stageReviewInfo(input: {
  current: StageKey;
  reviews: readonly StageReview[];
  progress: Pick<StageProgress, 'isComplete' | 'completed'>;
  /** Latest founder activity on this stage (requirement or evidence change), ISO time. */
  lastActivityAt?: string | null;
  /**
   * Keep the approval up while the founder has not acted since it (instead of while nothing
   * is completed). Investor Readiness starts partly complete from existing startup data.
   */
  approvalUntilActivity?: boolean;
  now?: Date;
}): StageReviewInfo {
  const { current, reviews, progress } = input;
  const now = input.now ?? new Date();
  const nextStage = nextReviewStage(current);
  const latest = reviewsOfStage(reviews, current)[0] ?? null;

  if (latest?.status === 'pending') {
    return { state: 'pending', review: latest, nextStage, improvedSinceFeedback: false };
  }
  if (latest?.status === 'needs_work') {
    const improved = Boolean(
      input.lastActivityAt && latest.reviewed_at && input.lastActivityAt > latest.reviewed_at,
    );
    return { state: 'needs_work', review: latest, nextStage, improvedSinceFeedback: improved };
  }

  const approval = reviewHistory(reviews).find(
    (r) => r.status === 'approved' && r.to_stage === current,
  );
  const untouched = input.approvalUntilActivity
    ? !input.lastActivityAt || (approval?.reviewed_at ?? '') >= input.lastActivityAt
    : progress.completed === 0;
  if (approval?.reviewed_at && untouched) {
    const ageDays = (now.getTime() - new Date(approval.reviewed_at).getTime()) / 86_400_000;
    if (ageDays <= APPROVED_STATE_DAYS) {
      return { state: 'approved', review: approval, nextStage, improvedSinceFeedback: false };
    }
  }

  if (progress.isComplete && nextStage) {
    return { state: 'ready', review: null, nextStage, improvedSinceFeedback: false };
  }
  return { state: 'not_ready', review: null, nextStage, improvedSinceFeedback: false };
}

/** Next best action text for a review state; null means "use the requirement action". */
export function reviewActionTitle(info: StageReviewInfo, current: StageKey): string | null {
  switch (info.state) {
    case 'ready':
      return `Request ${stageName(current)} review`;
    case 'pending':
      return `Your ${stageName(current)} stage is under review`;
    case 'needs_work':
      return 'Address innoWIUT feedback and resubmit';
    case 'approved':
      return `Continue to ${stageName(current)}`;
    case 'not_ready':
      return null;
  }
}

/** Whole days a pending review has waited (by calendar date). */
export function daysWaiting(requestedAt: string, now: Date = new Date()): number {
  const start = new Date(requestedAt);
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

type Metric = Parameters<typeof journeySummary>[2] extends readonly (infer M)[] | undefined
  ? M
  : never;

/**
 * Current stage summary with its review state. The next best action follows the review
 * state (request / under review / address feedback / continue) and otherwise falls back to
 * the deterministic requirement action.
 */
export function journeyReviewSummary(input: {
  current: StageKey;
  requirements: readonly StageRequirement[];
  metrics?: readonly Metric[];
  reviews: readonly StageReview[];
  evidence?: readonly Pick<StageEvidence, 'stage' | 'created_at'>[];
  now?: Date;
}) {
  const summary = journeySummary(input.current, input.requirements, input.metrics ?? []);
  const activity = [
    ...input.requirements.filter((r) => r.stage === input.current).map((r) => r.updated_at),
    ...(input.evidence ?? []).filter((e) => e.stage === input.current).map((e) => e.created_at),
  ].sort();
  const review = stageReviewInfo({
    current: input.current,
    reviews: input.reviews,
    progress: summary,
    lastActivityAt: activity.at(-1) ?? null,
    now: input.now,
  });
  const title = reviewActionTitle(review, input.current);
  return { ...summary, review, next: title ? { ...summary.next, title } : summary.next };
}
