// Startup Journey (V2.1): stages, requirement templates and the deterministic rules for
// progress and "next best action". Framework-free so the founder and admin screens and the
// tests all use exactly the same logic.
//
// Requirement rows live in public.startup_stage_requirements; the Idea / Validation / MVP
// templates below mirror private.stage_requirement_templates() in the database. Nothing here
// ever changes a startup's stage — completing every requirement only reports it.
import type { Enums, Tables } from '@/types/database';
import { calculateChangePercent } from './traction';

export type StageKey = Enums<'startup_stage'>;
export type RequirementStatus = Enums<'requirement_status'>;
export type EvidenceType = Enums<'evidence_type'>;
export type StageRequirement = Tables<'startup_stage_requirements'>;
export type StageEvidence = Tables<'stage_evidence'>;
type Metric = Pick<
  Tables<'traction_metrics'>,
  'id' | 'name' | 'current_value' | 'last_recorded_on' | 'is_archived'
>;
type Entry = Pick<Tables<'traction_entries'>, 'metric_id' | 'value' | 'recorded_on' | 'created_at'>;

export interface RequirementTemplate {
  key: string;
  title: string;
  hint: string;
  evidenceHint: string;
  target?: number;
  /** Plural noun for the target, e.g. "customer interviews". */
  targetLabel?: string;
}

export interface TractionOption {
  key: string;
  title: string;
  /** Traction metric names (lower case) that count as this option. */
  metricNames: string[];
}

export interface JourneyStage {
  key: StageKey;
  number: string;
  name: string;
  purpose: string;
  locked: boolean;
  /** Traction: the founder chooses which metrics prove the stage. */
  flexible: boolean;
  requirements: RequirementTemplate[];
}

export const JOURNEY_STAGES: JourneyStage[] = [
  {
    key: 'idea',
    number: '01',
    name: 'Idea',
    purpose: 'Define the startup clearly.',
    locked: false,
    flexible: false,
    requirements: [
      {
        key: 'problem_statement',
        title: 'Problem Statement',
        hint: 'What problem are you solving, and for whom?',
        evidenceHint: 'Problem write-up',
      },
      {
        key: 'target_customer',
        title: 'Target Customer',
        hint: 'Who exactly is your customer?',
        evidenceHint: 'Customer definition',
      },
      {
        key: 'solution',
        title: 'Solution',
        hint: 'How does your product solve the problem?',
        evidenceHint: 'Solution sketch or document',
      },
      {
        key: 'founder_team',
        title: 'Founder / Team',
        hint: 'Who is building this, and why you?',
        evidenceHint: 'Team profiles',
      },
      {
        key: 'market_hypothesis',
        title: 'Market Hypothesis',
        hint: 'What do you believe about the market you are entering?',
        evidenceHint: 'Market notes',
      },
    ],
  },
  {
    key: 'validation',
    number: '02',
    name: 'Validation',
    purpose: 'Prove the problem is real.',
    locked: false,
    flexible: false,
    requirements: [
      {
        key: 'customer_interviews',
        title: 'Customer Interviews',
        hint: 'How many potential customers have you spoken to?',
        evidenceHint: 'Interview notes',
        target: 10,
        targetLabel: 'customer interviews',
      },
      {
        key: 'problem_validation',
        title: 'Problem Validation',
        hint: 'What did customers confirm about the problem?',
        evidenceHint: 'Quotes or findings',
      },
      {
        key: 'customer_persona',
        title: 'Customer Persona',
        hint: 'Describe the person you are building for.',
        evidenceHint: 'Persona document',
      },
      {
        key: 'competitor_research',
        title: 'Competitor Research',
        hint: 'Who else solves this, and how are you different?',
        evidenceHint: 'Competitor list or analysis',
      },
      {
        key: 'pricing_willingness',
        title: 'Pricing / Willingness to Pay',
        hint: 'What have customers said they would pay?',
        evidenceHint: 'Pricing test or quotes',
      },
      {
        key: 'key_assumptions',
        title: 'Key Assumptions',
        hint: 'Which assumptions must be true for this to work?',
        evidenceHint: 'Assumption list',
      },
    ],
  },
  {
    key: 'mvp',
    number: '03',
    name: 'MVP',
    purpose: 'Build and test a real solution.',
    locked: false,
    flexible: false,
    requirements: [
      {
        key: 'working_mvp',
        title: 'Working MVP',
        hint: 'Does the product actually work end to end?',
        evidenceHint: 'Product link or screenshot',
      },
      {
        key: 'product_url',
        title: 'Product URL',
        hint: 'Where can innoWIUT see the product?',
        evidenceHint: 'Product link',
      },
      {
        key: 'demo',
        title: 'Demo',
        hint: 'Show the product in action.',
        evidenceHint: 'Video or walkthrough',
      },
      {
        key: 'user_testing',
        title: 'User Testing',
        hint: 'How many people have used it?',
        evidenceHint: 'Test notes',
        target: 5,
        targetLabel: 'test users',
      },
      {
        key: 'user_feedback',
        title: 'User Feedback',
        hint: 'What did users say after trying it?',
        evidenceHint: 'Feedback note',
      },
      {
        key: 'core_workflow',
        title: 'Core Workflow',
        hint: 'What is the one flow the product must nail?',
        evidenceHint: 'Screenshot or walkthrough',
      },
    ],
  },
  {
    key: 'traction',
    number: '04',
    name: 'Traction',
    purpose: 'Show real market signal.',
    locked: false,
    flexible: true,
    requirements: [],
  },
  {
    key: 'investor_readiness',
    number: '05',
    name: 'Investor Readiness',
    purpose: 'Prepare the story, numbers and materials.',
    locked: true,
    flexible: false,
    requirements: [],
  },
  {
    key: 'investor_access',
    number: '06',
    name: 'Investor Access',
    purpose: 'Meet the right investors at the right time.',
    locked: true,
    flexible: false,
    requirements: [],
  },
];

/** Must match private.traction_requirement_title() in the database. */
export const TRACTION_OPTIONS: TractionOption[] = [
  { key: 'active_users', title: 'Active Users', metricNames: ['active users', 'users'] },
  { key: 'revenue', title: 'Revenue', metricNames: ['revenue', 'monthly revenue'] },
  { key: 'mrr', title: 'MRR', metricNames: ['mrr'] },
  { key: 'pilots', title: 'Pilots', metricNames: ['pilots'] },
  { key: 'retention', title: 'Retention', metricNames: ['retention'] },
  { key: 'conversion', title: 'Conversion', metricNames: ['conversion'] },
  { key: 'transactions', title: 'Transactions', metricNames: ['transactions'] },
  { key: 'partnerships', title: 'Partnerships', metricNames: ['partnerships'] },
  { key: 'lois', title: 'LOIs', metricNames: ['lois', 'loi'] },
  { key: 'waitlist', title: 'Waitlist', metricNames: ['waitlist'] },
];

export const OPEN_STAGE_KEYS = ['idea', 'validation', 'mvp', 'traction'] as const;
export type OpenStageKey = (typeof OPEN_STAGE_KEYS)[number];

export const REQUIREMENT_STATUSES: {
  value: RequirementStatus;
  label: string;
  tone: 'neutral' | 'warning' | 'blue' | 'positive';
}[] = [
  { value: 'not_started', label: 'Not Started', tone: 'neutral' },
  { value: 'in_progress', label: 'In Progress', tone: 'warning' },
  { value: 'ready_for_review', label: 'Ready for Review', tone: 'blue' },
  { value: 'completed', label: 'Completed', tone: 'positive' },
];

export const EVIDENCE_TYPES: { value: EvidenceType; label: string }[] = [
  { value: 'product_url', label: 'Product URL' },
  { value: 'link', label: 'Link' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'document', label: 'Document' },
  { value: 'metric', label: 'Metric' },
  { value: 'customer_feedback', label: 'Customer Feedback' },
  { value: 'text_note', label: 'Text Note' },
];

/** Must match the startup_updates.progress_types check constraint. */
export const PROGRESS_TYPES = [
  'Product',
  'Customer Validation',
  'Traction',
  'Revenue',
  'Partnership',
  'Team',
  'Fundraising Preparation',
  'Other',
] as const;
export type ProgressType = (typeof PROGRESS_TYPES)[number];

export function getStage(key: StageKey | null | undefined): JourneyStage {
  return JOURNEY_STAGES.find((stage) => stage.key === key) ?? JOURNEY_STAGES[0]!;
}

export function isStageKey(value: string | null | undefined): value is StageKey {
  return JOURNEY_STAGES.some((stage) => stage.key === value);
}

export const stageName = (key: StageKey | null | undefined) => getStage(key).name;
export const statusLabel = (status: RequirementStatus) =>
  REQUIREMENT_STATUSES.find((s) => s.value === status)?.label ?? status;
export const evidenceTypeLabel = (type: EvidenceType) =>
  EVIDENCE_TYPES.find((t) => t.value === type)?.label ?? 'Evidence';

export type StagePosition = 'completed' | 'current' | 'upcoming' | 'locked';

/** Where a stage sits relative to the startup's current stage (position only, no review). */
export function stagePosition(key: StageKey, current: StageKey): StagePosition {
  const stage = getStage(key);
  if (stage.locked) return 'locked';
  const index = JOURNEY_STAGES.indexOf(stage);
  const currentIndex = JOURNEY_STAGES.indexOf(getStage(current));
  if (index < currentIndex) return 'completed';
  return index === currentIndex ? 'current' : 'upcoming';
}

/** Rows of one stage in template order (traction rows in the order they were chosen). */
export function stageRequirements(
  stageKey: StageKey,
  rows: readonly StageRequirement[],
): StageRequirement[] {
  const stage = getStage(stageKey);
  const own = rows.filter((row) => row.stage === stageKey);
  if (stage.flexible) {
    const order = TRACTION_OPTIONS.map((o) => o.key);
    return [...own].sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) ||
        order.indexOf(a.requirement_key) - order.indexOf(b.requirement_key),
    );
  }
  const order = stage.requirements.map((r) => r.key);
  return [...own].sort((a, b) => rank(order, a.requirement_key) - rank(order, b.requirement_key));
}

const rank = (order: string[], key: string) => {
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
};

export function templateFor(row: Pick<StageRequirement, 'stage' | 'requirement_key'>) {
  return getStage(row.stage).requirements.find((r) => r.key === row.requirement_key) ?? null;
}

export interface StageProgress {
  rows: StageRequirement[];
  total: number;
  completed: number;
  percent: number;
  /** Every required requirement is completed. Never changes the startup's stage. */
  isComplete: boolean;
}

export function stageProgress(
  stageKey: StageKey,
  rows: readonly StageRequirement[],
): StageProgress {
  const ordered = stageRequirements(stageKey, rows);
  const required = ordered.filter((row) => row.required);
  const completed = required.filter((row) => row.status === 'completed').length;
  const total = required.length;
  return {
    rows: ordered,
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
    isComplete: total > 0 && completed === total,
  };
}

export type NextActionKind =
  | 'locked'
  | 'choose_metrics'
  | 'link_metric'
  | 'record_metric'
  | 'reach_target'
  | 'complete_requirement'
  | 'stage_complete';

export interface NextAction {
  kind: NextActionKind;
  title: string;
  requirementId: string | null;
}

/**
 * The single next thing to do in a stage. Deterministic: the first unfinished required
 * requirement in template order decides it. No scoring, no recommendation engine.
 */
export function nextAction(
  stageKey: StageKey,
  rows: readonly StageRequirement[],
  metrics: readonly Metric[] = [],
): NextAction {
  const stage = getStage(stageKey);
  if (stage.locked) {
    return { kind: 'locked', title: 'Opens in a later phase.', requirementId: null };
  }
  const progress = stageProgress(stageKey, rows);
  if (stage.flexible && progress.total === 0) {
    return {
      kind: 'choose_metrics',
      title: 'Choose the traction metrics that matter for your business',
      requirementId: null,
    };
  }
  if (progress.isComplete) {
    return {
      kind: 'stage_complete',
      title: 'Stage requirements completed — keep your evidence up to date',
      requirementId: null,
    };
  }
  const pending = progress.rows.filter((row) => row.required && row.status !== 'completed');
  const first = pending[0];
  if (!first) {
    return { kind: 'stage_complete', title: 'Keep your evidence up to date', requirementId: null };
  }
  if (stage.flexible) {
    for (const row of pending) {
      const metric = metrics.find((m) => m.id === row.linked_metric_id && !m.is_archived);
      if (!metric) {
        return {
          kind: 'link_metric',
          title: `Link ${row.title} to a traction metric`,
          requirementId: row.id,
        };
      }
      if (metric.current_value === null) {
        return {
          kind: 'record_metric',
          title: `Record your first ${metric.name} value`,
          requirementId: row.id,
        };
      }
    }
    return {
      kind: 'complete_requirement',
      title: `Mark "${first.title}" complete once the numbers prove it`,
      requirementId: first.id,
    };
  }
  const target = first.progress_target;
  const value = Number(first.progress_value ?? 0);
  if (target !== null && value < Number(target)) {
    const label = templateFor(first)?.targetLabel ?? first.title.toLowerCase();
    return {
      kind: 'reach_target',
      title: `Complete ${formatCount(Math.max(Number(target) - value, 1))} more ${label}`,
      requirementId: first.id,
    };
  }
  return {
    kind: 'complete_requirement',
    title: `Complete "${first.title}"`,
    requirementId: first.id,
  };
}

const formatCount = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toLocaleString('en-US');

/** "3 of 5 requirements completed" (or selected metrics for Traction). */
export function progressText(summary: {
  stage: Pick<JourneyStage, 'flexible'>;
  completed: number;
  total: number;
}): string {
  return summary.stage.flexible
    ? `${summary.completed} of ${summary.total} selected metrics completed`
    : `${summary.completed} of ${summary.total} requirements completed`;
}

/** The founder's current-stage summary used by the dashboard and the journey page. */
export function journeySummary(
  current: StageKey,
  rows: readonly StageRequirement[],
  metrics: readonly Metric[] = [],
) {
  const stage = getStage(current);
  return { stage, ...stageProgress(stage.key, rows), next: nextAction(stage.key, rows, metrics) };
}

/** Evidence of a requirement, newest first. */
export function evidenceFor(
  requirementId: string,
  evidence: readonly StageEvidence[],
): StageEvidence[] {
  return evidence
    .filter((item) => item.requirement_id === requirementId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** The founder's existing metric that matches a traction option by name, if any. */
export function suggestedMetric<T extends Pick<Metric, 'id' | 'name' | 'is_archived'>>(
  optionKey: string,
  metrics: readonly T[],
): T | null {
  const option = TRACTION_OPTIONS.find((o) => o.key === optionKey);
  if (!option) return null;
  return (
    metrics.find(
      (m) => !m.is_archived && option.metricNames.includes(m.name.trim().toLowerCase()),
    ) ?? null
  );
}

export interface MetricMovement {
  previous: number | null;
  current: number | null;
  /** Percent change, or null when it cannot be calculated (no previous value, previous ≤ 0). */
  changePercent: number | null;
}

/**
 * Previous → current value of a metric as of a date, read from the raw traction history
 * (the source of truth). The founder never types the change.
 */
export function metricMovement(
  entries: readonly Entry[],
  metricId: string,
  asOf?: string | null,
): MetricMovement {
  const history = entries
    .filter((e) => e.metric_id === metricId && (!asOf || e.recorded_on <= asOf))
    .sort(
      (a, b) =>
        b.recorded_on.localeCompare(a.recorded_on) || b.created_at.localeCompare(a.created_at),
    );
  const current = history[0] ? Number(history[0].value) : null;
  const previous = history[1] ? Number(history[1].value) : null;
  return { previous, current, changePercent: calculateChangePercent(previous, current) };
}
