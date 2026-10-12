import { describe, expect, it } from 'vitest';
import {
  missingRequirements,
  readinessCompletion,
  readinessNextAction,
  readinessSummary,
  sectionProgress,
  type ReadinessStateRow,
} from './readiness';
import { nextReviewStage, reviewStateLabel, type StageReview } from './reviews';
import { stagePosition } from './journey';

let order = 0;
const row = (key: string, overrides: Partial<ReadinessStateRow> = {}): ReadinessStateRow => ({
  requirement_id: `req-${key}`,
  section: 'company',
  requirement_key: key,
  title: key,
  description: '',
  required: true,
  input_kind: 'text',
  allows_not_applicable: false,
  sort_order: ++order,
  not_applicable: false,
  is_complete: false,
  ...overrides,
});

const review = (overrides: Partial<StageReview> = {}): StageReview => ({
  id: 'r1',
  startup_id: 's',
  from_stage: 'investor_readiness',
  to_stage: 'investor_access',
  status: 'pending',
  review_type: 'investor_readiness',
  requirements_completed: 1,
  requirements_total: 1,
  feedback: null,
  admin_note: null,
  attention_requirement_ids: [],
  attention_sections: [],
  requested_by: null,
  requested_at: '2026-10-10T09:00:00Z',
  reviewed_by: null,
  reviewer_name: null,
  reviewed_at: null,
  created_at: '2026-10-10T09:00:00Z',
  ...overrides,
});

describe('readiness completion', () => {
  it('counts only mandatory, applicable requirements', () => {
    const rows = [
      row('a', { is_complete: true }),
      row('b'),
      row('optional', { required: false, is_complete: true }),
      row('na', { not_applicable: true, allows_not_applicable: true }),
    ];
    expect(readinessCompletion(rows)).toEqual({
      total: 2,
      completed: 1,
      missing: 1,
      percent: 50,
      isComplete: false,
    });
  });

  it('is complete only when every counted requirement is complete', () => {
    expect(readinessCompletion([row('a', { is_complete: true })]).isComplete).toBe(true);
    expect(readinessCompletion([]).isComplete).toBe(false);
  });

  it('rounds the percent', () => {
    const rows = [row('a', { is_complete: true }), row('b'), row('c')];
    expect(readinessCompletion(rows).percent).toBe(33);
  });

  it('groups progress by section in a fixed order', () => {
    const rows = [
      row('deck', { section: 'investor_materials', is_complete: true }),
      row('name', { section: 'company', is_complete: true }),
      row('site', { section: 'company' }),
    ];
    const sections = sectionProgress(rows);
    expect(sections.map((s) => s.key)[0]).toBe('company');
    expect(sections).toHaveLength(9);
    expect(sections.find((s) => s.key === 'company')).toMatchObject({
      total: 2,
      completed: 1,
      status: 'in_progress',
    });
    expect(sections.find((s) => s.key === 'investor_materials')?.status).toBe('complete');
    expect(sections.find((s) => s.key === 'team')?.status).toBe('not_started');
  });
});

describe('readiness next action', () => {
  const idle = { state: 'not_ready' as const, improvedSinceFeedback: false };

  it('prioritises the pitch deck, then target raise, metrics and financial model', () => {
    const rows = [
      row('problem_statement'),
      row('financial_model'),
      row('primary_investor_metrics'),
      row('target_raise'),
      row('pitch_deck'),
    ];
    expect(readinessNextAction({ rows, review: idle }).title).toBe('Upload pitch deck');
    rows[4]!.is_complete = true;
    expect(readinessNextAction({ rows, review: idle }).title).toBe('Add target raise');
    rows[3]!.is_complete = true;
    expect(readinessNextAction({ rows, review: idle }).title).toBe(
      'Select primary investor metrics',
    );
    rows[2]!.is_complete = true;
    expect(readinessNextAction({ rows, review: idle }).title).toBe('Complete financial model');
    rows[1]!.is_complete = true;
    expect(readinessNextAction({ rows, review: idle })).toMatchObject({
      title: 'Complete "problem_statement"',
      requirementKey: 'problem_statement',
    });
  });

  it('skips not-applicable requirements', () => {
    const rows = [row('financial_model', { not_applicable: true }), row('use_of_funds')];
    expect(readinessNextAction({ rows, review: idle }).requirementKey).toBe('use_of_funds');
    expect(missingRequirements(rows)).toHaveLength(1);
  });

  it('asks for the review once everything is complete', () => {
    const rows = [row('a', { is_complete: true })];
    expect(readinessNextAction({ rows, review: { ...idle, state: 'ready' } })).toMatchObject({
      intent: 'request',
      title: 'Request Investor Readiness Review',
    });
  });

  it('follows the review and interview state', () => {
    const rows = [row('a', { is_complete: true })];
    const pending = { state: 'pending' as const, improvedSinceFeedback: false };
    expect(readinessNextAction({ rows, review: pending }).intent).toBe('pending');
    expect(
      readinessNextAction({ rows, review: pending, interview: { status: 'scheduled' } }).title,
    ).toBe('Attend scheduled interview');
    expect(
      readinessNextAction({ rows, review: { state: 'needs_work', improvedSinceFeedback: false } })
        .title,
    ).toBe('Address innoWIUT feedback');
    expect(
      readinessNextAction({ rows, review: { state: 'needs_work', improvedSinceFeedback: true } })
        .title,
    ).toBe('Resubmit Investor Readiness Review');
    expect(
      readinessNextAction({
        rows,
        review: { ...idle, state: 'ready' },
        interview: { status: 'scheduled' },
      }).title,
    ).toBe('Attend scheduled interview');
    expect(readinessNextAction({ rows, review: { ...idle, state: 'approved' } }).intent).toBe(
      'access',
    );
  });
});

describe('readiness summary', () => {
  const rows = [row('a', { is_complete: true }), row('b')];

  it('reports completion and the readiness review state', () => {
    const summary = readinessSummary({ rows, reviews: [] });
    expect(summary).toMatchObject({ percent: 50, completed: 1, total: 2, isComplete: false });
    expect(summary.review.state).toBe('not_ready');
    expect(summary.review.nextStage).toBe('investor_access');
  });

  it('is pending while a readiness review waits', () => {
    expect(readinessSummary({ rows, reviews: [review()] }).review.state).toBe('pending');
  });

  it('flags changes made after Needs Work', () => {
    const decided = review({
      status: 'needs_work',
      feedback: 'Add a financial model',
      reviewed_at: '2026-10-11T09:00:00Z',
    });
    expect(readinessSummary({ rows, reviews: [decided] }).review).toMatchObject({
      state: 'needs_work',
      improvedSinceFeedback: false,
    });
    expect(
      readinessSummary({
        rows,
        reviews: [decided],
        requirements: [{ updated_at: '2026-10-11T10:00:00Z' }],
      }).review.improvedSinceFeedback,
    ).toBe(true);
  });

  it('shows the Traction approval until the founder acts, even with derived data complete', () => {
    const approval = review({
      id: 'r0',
      from_stage: 'traction',
      to_stage: 'investor_readiness',
      review_type: 'stage',
      status: 'approved',
      reviewed_at: '2026-10-11T09:00:00Z',
    });
    const now = new Date('2026-10-12T09:00:00Z');
    expect(
      readinessSummary({
        rows,
        reviews: [approval],
        requirements: [{ updated_at: '2026-10-11T09:00:00Z' }],
        now,
      }).review.state,
    ).toBe('approved');
    expect(
      readinessSummary({
        rows,
        reviews: [approval],
        requirements: [{ updated_at: '2026-10-11T12:00:00Z' }],
        now,
      }).review.state,
    ).toBe('not_ready');
  });
});

describe('investor stages', () => {
  it('reviews move Traction → Investor Readiness → Investor Access', () => {
    expect(nextReviewStage('traction')).toBe('investor_readiness');
    expect(nextReviewStage('investor_readiness')).toBe('investor_access');
    expect(nextReviewStage('investor_access')).toBeNull();
  });

  it('labels an approved readiness review "Investor Ready"', () => {
    expect(reviewStateLabel('approved', 'investor_readiness')).toBe('Investor Ready');
    expect(reviewStateLabel('approved', 'stage')).toBe('Approved');
    expect(reviewStateLabel('pending', 'investor_readiness')).toBe('Pending Review');
  });

  it('keeps Investor Access locked until it is the current stage', () => {
    expect(stagePosition('investor_access', 'investor_readiness')).toBe('locked');
    expect(stagePosition('investor_access', 'investor_access')).toBe('current');
    expect(stagePosition('investor_readiness', 'traction')).toBe('upcoming');
  });
});
