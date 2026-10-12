import { describe, expect, it } from 'vitest';
import type { StageRequirement } from './journey';
import {
  REVIEW_STATE_META,
  canRequestReview,
  daysWaiting,
  journeyReviewSummary,
  nextReviewStage,
  reviewActionTitle,
  reviewHistory,
  stageReviewInfo,
  type StageReview,
} from './reviews';

const review = (overrides: Partial<StageReview>): StageReview => ({
  id: 'r1',
  startup_id: 's1',
  from_stage: 'validation',
  to_stage: 'mvp',
  status: 'pending',
  requirements_completed: 6,
  requirements_total: 6,
  requested_by: 'u1',
  requested_at: '2026-10-10T09:00:00Z',
  reviewed_by: null,
  reviewer_name: null,
  reviewed_at: null,
  feedback: null,
  admin_note: null,
  attention_requirement_ids: [],
  attention_sections: [],
  review_type: 'stage',
  created_at: '2026-10-10T09:00:00Z',
  ...overrides,
});
const complete = { isComplete: true, completed: 6 };
const partial = { isComplete: false, completed: 3 };
const fresh = { isComplete: false, completed: 0 };
const now = new Date('2026-10-12T12:00:00Z');

describe('review stages', () => {
  it('reviews move to the next stage; Investor Access is never reviewed', () => {
    expect(nextReviewStage('idea')).toBe('validation');
    expect(nextReviewStage('validation')).toBe('mvp');
    expect(nextReviewStage('mvp')).toBe('traction');
    expect(nextReviewStage('traction')).toBe('investor_readiness');
    expect(canRequestReview('traction')).toBe(true);
    expect(canRequestReview('investor_access')).toBe(false);
  });

  it('uses five subtle status pills', () => {
    expect(
      Object.fromEntries(Object.entries(REVIEW_STATE_META).map(([k, v]) => [k, v.label])),
    ).toEqual({
      not_ready: 'Not Ready',
      ready: 'Ready',
      pending: 'Pending Review',
      needs_work: 'Needs Work',
      approved: 'Approved',
    });
  });
});

describe('stageReviewInfo', () => {
  it('not ready while requirements are open', () => {
    expect(
      stageReviewInfo({ current: 'validation', reviews: [], progress: partial, now }).state,
    ).toBe('not_ready');
  });

  it('ready once every required requirement is completed', () => {
    const info = stageReviewInfo({ current: 'validation', reviews: [], progress: complete, now });
    expect(info).toMatchObject({ state: 'ready', nextStage: 'mvp' });
  });

  it('a complete Traction stage is ready for review (V2.3)', () => {
    expect(
      stageReviewInfo({ current: 'traction', reviews: [], progress: complete, now }),
    ).toMatchObject({ state: 'ready', nextStage: 'investor_readiness' });
  });

  it('pending while a review is open', () => {
    const info = stageReviewInfo({
      current: 'validation',
      reviews: [review({})],
      progress: complete,
      now,
    });
    expect(info).toMatchObject({ state: 'pending', review: { id: 'r1' } });
  });

  it('needs work after the latest review was sent back, and notices later changes', () => {
    const sentBack = review({
      status: 'needs_work',
      reviewed_at: '2026-10-11T10:00:00Z',
      feedback: 'Add 3 more interview notes.',
    });
    const before = stageReviewInfo({
      current: 'validation',
      reviews: [sentBack],
      progress: complete,
      lastActivityAt: '2026-10-11T09:00:00Z',
      now,
    });
    expect(before).toMatchObject({ state: 'needs_work', improvedSinceFeedback: false });
    const after = stageReviewInfo({
      current: 'validation',
      reviews: [sentBack],
      progress: complete,
      lastActivityAt: '2026-10-11T11:00:00Z',
      now,
    });
    expect(after.improvedSinceFeedback).toBe(true);
  });

  it('a resubmission after needs work is pending again', () => {
    const reviews = [
      review({
        id: 'old',
        status: 'needs_work',
        reviewed_at: '2026-10-11T10:00:00Z',
        feedback: 'x',
      }),
      review({ id: 'new', requested_at: '2026-10-12T08:00:00Z' }),
    ];
    expect(
      stageReviewInfo({ current: 'validation', reviews, progress: complete, now }),
    ).toMatchObject({
      state: 'pending',
      review: { id: 'new' },
    });
  });

  it('approved into the new stage shows briefly, then gives way to normal progress', () => {
    const approved = review({ status: 'approved', reviewed_at: '2026-10-12T09:00:00Z' });
    expect(
      stageReviewInfo({ current: 'mvp', reviews: [approved], progress: fresh, now }),
    ).toMatchObject({ state: 'approved', nextStage: 'traction' });
    expect(
      stageReviewInfo({
        current: 'mvp',
        reviews: [approved],
        progress: { isComplete: false, completed: 1 },
        now,
      }).state,
    ).toBe('not_ready');
    expect(
      stageReviewInfo({
        current: 'mvp',
        reviews: [approved],
        progress: fresh,
        now: new Date('2026-11-30T00:00:00Z'),
      }).state,
    ).toBe('not_ready');
  });
});

describe('next best action follows the review state', () => {
  const titleFor = (
    state: Parameters<typeof reviewActionTitle>[0]['state'],
    current = 'validation' as const,
  ) =>
    reviewActionTitle(
      { state, review: null, nextStage: 'mvp', improvedSinceFeedback: false },
      current,
    );

  it('maps every state', () => {
    expect(titleFor('not_ready')).toBeNull();
    expect(titleFor('ready')).toBe('Request Validation review');
    expect(titleFor('pending')).toBe('Your Validation stage is under review');
    expect(titleFor('needs_work')).toBe('Address innoWIUT feedback and resubmit');
    expect(
      reviewActionTitle(
        { state: 'approved', review: null, nextStage: 'traction', improvedSinceFeedback: false },
        'mvp',
      ),
    ).toBe('Continue to MVP');
  });

  it('falls back to the requirement action when not ready', () => {
    const req = (
      key: string,
      status: StageRequirement['status'],
      extra: Partial<StageRequirement> = {},
    ) =>
      ({
        id: key,
        startup_id: 's1',
        stage: 'validation',
        requirement_key: key,
        title: key,
        description: null,
        required: true,
        status,
        progress_value: null,
        progress_target: null,
        linked_metric_id: null,
        completed_at: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        ...extra,
      }) as StageRequirement;
    const requirements = [
      req('customer_interviews', 'in_progress', { progress_value: 8, progress_target: 10 }),
      req('problem_validation', 'completed'),
    ];
    const summary = journeyReviewSummary({ current: 'validation', requirements, reviews: [], now });
    expect(summary.next.title).toBe('Complete 2 more customer interviews');
    expect(summary.review.state).toBe('not_ready');
    const done = requirements.map((r) => ({ ...r, status: 'completed' as const }));
    expect(
      journeyReviewSummary({ current: 'validation', requirements: done, reviews: [], now }).next
        .title,
    ).toBe('Request Validation review');
  });
});

describe('helpers', () => {
  it('lists history newest first and counts days waiting', () => {
    const list = reviewHistory([
      review({ id: 'a', requested_at: '2026-10-01T00:00:00Z' }),
      review({ id: 'b', requested_at: '2026-10-05T00:00:00Z' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
    expect(daysWaiting('2026-10-08T23:00:00Z', now)).toBe(4);
    expect(daysWaiting('2026-10-12T01:00:00Z', now)).toBe(0);
  });
});
