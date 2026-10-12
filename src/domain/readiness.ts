// Investor Readiness (V2.3): sections, readiness completion and the deterministic next action.
// Pure functions shared by the founder screens, the admin screens and the tests.
//
// Requirement completion is decided by the database (public.investor_readiness_state), which
// reads existing startup data (profile, team, traction, journey evidence) — nothing is
// re-entered or copied here. This is "Readiness completion", never a score.
import type { Enums, Tables } from '@/types/database';
import { getStage, type NextAction, type StageEvidence } from './journey';
import { stageReviewInfo, type StageReview, type StageReviewInfo } from './reviews';

export type ReadinessSection = Enums<'readiness_section'>;
export type InterviewStatus = Enums<'interview_status'>;
export type ReadinessProfile = Tables<'investor_readiness_profiles'>;
export type ReadinessRequirement = Tables<'investor_readiness_requirements'>;
export type ReadinessInterview = Pick<
  Tables<'readiness_interviews'>,
  'id' | 'startup_id' | 'status' | 'scheduled_at' | 'location_or_link' | 'completed_at'
>;

/** One row of public.investor_readiness_state(). */
export interface ReadinessStateRow {
  requirement_id: string;
  section: ReadinessSection;
  requirement_key: string;
  title: string;
  description: string;
  required: boolean;
  input_kind: string;
  allows_not_applicable: boolean;
  sort_order: number;
  not_applicable: boolean;
  is_complete: boolean;
}

export const READINESS_SECTIONS: { key: ReadinessSection; name: string; description: string }[] = [
  { key: 'company', name: 'Company', description: 'From your startup profile.' },
  {
    key: 'problem_market',
    name: 'Problem & Market',
    description: 'The problem, the customer and the market.',
  },
  { key: 'product', name: 'Product', description: 'What exists today and where to see it.' },
  { key: 'traction', name: 'Traction', description: 'Your existing traction metrics.' },
  { key: 'business_model', name: 'Business Model', description: 'How the company makes money.' },
  { key: 'team', name: 'Team', description: 'Who is building this, and how committed.' },
  { key: 'fundraising', name: 'Fundraising', description: 'The round you are preparing.' },
  {
    key: 'legal_operations',
    name: 'Legal & Operations',
    description: 'What an investor checks before investing.',
  },
  {
    key: 'investor_materials',
    name: 'Investor Materials',
    description: 'The documents an investor asks for first.',
  },
];

export const sectionName = (key: ReadinessSection) =>
  READINESS_SECTIONS.find((s) => s.key === key)?.name ?? key;

// Must match the check constraints on public.investor_readiness_profiles.
export const BUSINESS_TYPES = ['B2B', 'B2C', 'B2B2C', 'Marketplace', 'B2G', 'Other'] as const;
export const PRODUCT_STAGES = [
  { value: 'prototype', label: 'Prototype' },
  { value: 'mvp', label: 'MVP' },
  { value: 'beta', label: 'Beta' },
  { value: 'launched', label: 'Launched' },
  { value: 'scaling', label: 'Scaling' },
] as const;
export const ROUND_TYPES = [
  { value: 'pre_seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'grant', label: 'Grant' },
  { value: 'other', label: 'Other' },
] as const;
export const COMMITMENTS: { value: Enums<'team_commitment'>; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
];

export const optionLabel = (
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) => options.find((o) => o.value === value)?.label ?? value ?? null;

/** Mandatory, applicable requirements only (not-applicable rows count in neither number). */
export function readinessCompletion(rows: readonly ReadinessStateRow[]) {
  const counted = rows.filter((r) => r.required && !r.not_applicable);
  const completed = counted.filter((r) => r.is_complete).length;
  const total = counted.length;
  return {
    total,
    completed,
    missing: total - completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
    isComplete: total > 0 && completed === total,
  };
}

export type SectionStatus = 'complete' | 'in_progress' | 'not_started';

export interface SectionProgress {
  key: ReadinessSection;
  name: string;
  rows: ReadinessStateRow[];
  total: number;
  completed: number;
  percent: number;
  status: SectionStatus;
}

export function sectionProgress(rows: readonly ReadinessStateRow[]): SectionProgress[] {
  return READINESS_SECTIONS.map((section) => {
    const own = rows
      .filter((r) => r.section === section.key)
      .sort((a, b) => a.sort_order - b.sort_order);
    const { total, completed, percent } = readinessCompletion(own);
    const status: SectionStatus =
      total > 0 && completed === total ? 'complete' : completed > 0 ? 'in_progress' : 'not_started';
    return { key: section.key, name: section.name, rows: own, total, completed, percent, status };
  });
}

/** The required, applicable rows that are not complete yet, in template order. */
export const missingRequirements = (rows: readonly ReadinessStateRow[]) =>
  rows
    .filter((r) => r.required && !r.not_applicable && !r.is_complete)
    .sort((a, b) => a.sort_order - b.sort_order);

/** Founder wording for the requirements an investor asks about first. */
const PRIORITY: { key: string; title: string }[] = [
  { key: 'pitch_deck', title: 'Upload pitch deck' },
  { key: 'target_raise', title: 'Add target raise' },
  { key: 'primary_investor_metrics', title: 'Select primary investor metrics' },
  { key: 'financial_model', title: 'Complete financial model' },
];

export interface ReadinessNextAction extends NextAction {
  kind: 'readiness';
  /** What the action does in the UI. */
  intent: 'complete' | 'request' | 'pending' | 'feedback' | 'resubmit' | 'interview' | 'access';
  requirementKey: string | null;
}

/**
 * The single next thing to do in Investor Readiness. Deterministic for the same input:
 *   review pending + interview scheduled → attend interview
 *   review pending → wait for the review
 *   needs work → address feedback (resubmit once complete and changed)
 *   interview scheduled → attend interview
 *   every mandatory requirement complete → request the review
 *   otherwise the first missing priority requirement, then the first missing in order.
 */
export function readinessNextAction(input: {
  rows: readonly ReadinessStateRow[];
  review: Pick<StageReviewInfo, 'state' | 'improvedSinceFeedback'>;
  interview?: Pick<ReadinessInterview, 'status'> | null;
}): ReadinessNextAction {
  const { rows, review } = input;
  const scheduled = input.interview?.status === 'scheduled';
  const completion = readinessCompletion(rows);
  const action = (
    intent: ReadinessNextAction['intent'],
    title: string,
    row: ReadinessStateRow | null = null,
  ): ReadinessNextAction => ({
    kind: 'readiness',
    intent,
    title,
    requirementId: row?.requirement_id ?? null,
    requirementKey: row?.requirement_key ?? null,
  });

  if (review.state === 'approved') {
    return action('access', 'Investor Ready — Investor Access is unlocked');
  }
  if (review.state === 'pending') {
    return scheduled
      ? action('interview', 'Attend scheduled interview')
      : action('pending', 'Your Investor Readiness review is in progress');
  }
  const missing = missingRequirements(rows);
  if (review.state === 'needs_work') {
    if (completion.isComplete && review.improvedSinceFeedback) {
      return action('resubmit', 'Resubmit Investor Readiness Review');
    }
    return action('feedback', 'Address innoWIUT feedback', missing[0] ?? null);
  }
  if (scheduled) return action('interview', 'Attend scheduled interview');
  if (completion.isComplete) return action('request', 'Request Investor Readiness Review');
  for (const priority of PRIORITY) {
    const row = missing.find((r) => r.requirement_key === priority.key);
    if (row) return action('complete', priority.title, row);
  }
  const first = missing[0];
  return first
    ? action('complete', `Complete "${first.title}"`, first)
    : action('complete', 'Complete your readiness requirements');
}

/** Latest founder activity on readiness data (for "changed since feedback"). */
export function readinessLastActivity(input: {
  requirements?: readonly Pick<ReadinessRequirement, 'updated_at'>[];
  profile?: Pick<ReadinessProfile, 'updated_at'> | null;
  evidence?: readonly { stage: string; created_at: string }[];
}): string | null {
  const times = [
    ...(input.requirements ?? []).map((r) => r.updated_at),
    ...(input.profile ? [input.profile.updated_at] : []),
    ...(input.evidence ?? [])
      .filter((e) => e.stage === 'investor_readiness')
      .map((e) => e.created_at),
  ].sort();
  return times.at(-1) ?? null;
}

/**
 * The founder's Investor Readiness summary in the same shape as the journey summary, so the
 * dashboard and journey cards render it unchanged: completion, review state and next action.
 */
export function readinessSummary(input: {
  rows: readonly ReadinessStateRow[];
  reviews: readonly StageReview[];
  requirements?: readonly Pick<ReadinessRequirement, 'updated_at'>[];
  profile?: Pick<ReadinessProfile, 'updated_at'> | null;
  evidence?: readonly Pick<StageEvidence, 'stage' | 'created_at'>[];
  interview?: Pick<ReadinessInterview, 'status'> | null;
  now?: Date;
}) {
  const completion = readinessCompletion(input.rows);
  const review = stageReviewInfo({
    current: 'investor_readiness',
    reviews: input.reviews,
    progress: completion,
    lastActivityAt: readinessLastActivity(input),
    approvalUntilActivity: true,
    now: input.now,
  });
  const next = readinessNextAction({ rows: input.rows, review, interview: input.interview });
  return {
    stage: getStage('investor_readiness'),
    rows: [],
    ...completion,
    review,
    next,
  };
}

/**
 * Investor Access, reached only through an approved Investor Readiness review. It has no
 * requirements and nothing to do yet: investor introductions come in a later stage.
 */
export function investorAccessSummary(reviews: readonly StageReview[]) {
  const approval =
    [...reviews]
      .filter((r) => r.review_type === 'investor_readiness' && r.status === 'approved')
      .sort((a, b) => (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? ''))[0] ?? null;
  const next: ReadinessNextAction = {
    kind: 'readiness',
    intent: 'access',
    title: 'Investor introductions will be available in the next stage',
    requirementId: null,
    requirementKey: null,
  };
  const review: StageReviewInfo = {
    state: 'approved',
    review: approval,
    nextStage: null,
    improvedSinceFeedback: false,
  };
  return {
    stage: getStage('investor_access'),
    rows: [],
    total: 0,
    completed: 0,
    missing: 0,
    percent: 100,
    isComplete: true,
    review,
    next,
  };
}
