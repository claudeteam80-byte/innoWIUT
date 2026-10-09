import { describe, expect, it } from 'vitest';
import { issues } from '@/test/zod';
import {
  buildUpdateRow,
  canQuickPublish,
  draftUpdateSchema,
  publishUpdateSchema,
  type UpdateFormValues,
} from './schemas';

const values: UpdateFormValues = {
  title: 'New onboarding flow',
  summary: '',
  progress_types: [],
  blocker: '',
  next_milestone: 'Reach 1,000 active users',
  next_milestone_date: '2026-11-30',
  linked_stage: 'mvp',
};

describe('update schemas', () => {
  it('lets a draft be saved with only a headline', () => {
    expect(draftUpdateSchema.safeParse(values).success).toBe(true);
    expect(issues(draftUpdateSchema.safeParse({ ...values, title: ' ' }))).toEqual({
      title: 'Give your update a headline.',
    });
  });

  it('requires "What moved?" and a progress type to publish', () => {
    expect(issues(publishUpdateSchema.safeParse(values))).toEqual({
      summary: 'Describe what moved before publishing.',
      progress_types: 'Choose at least one progress type.',
    });
    expect(
      publishUpdateSchema.safeParse({ ...values, summary: 'Launched', progress_types: ['Product'] })
        .success,
    ).toBe(true);
  });

  it('only accepts known progress types and open stages', () => {
    expect(
      draftUpdateSchema.safeParse({ ...values, progress_types: ['Hype'] as never }).success,
    ).toBe(false);
    expect(
      draftUpdateSchema.safeParse({ ...values, linked_stage: 'investor_access' as never }).success,
    ).toBe(false);
  });

  it('validates the milestone date', () => {
    expect(issues(draftUpdateSchema.safeParse({ ...values, next_milestone_date: 'soon' }))).toEqual(
      {
        next_milestone_date: 'Choose a valid date.',
      },
    );
  });
});

describe('buildUpdateRow (draft / publish behaviour)', () => {
  it('saves drafts with draft status and structured fields', () => {
    expect(buildUpdateRow(values, 'draft')).toEqual({
      title: 'New onboarding flow',
      summary: null,
      progress_types: [],
      blocker: null,
      next_milestone: 'Reach 1,000 active users',
      next_milestone_date: '2026-11-30',
      linked_stage: 'mvp',
      status: 'draft',
    });
  });

  it('never touches V1 columns', () => {
    const row = buildUpdateRow(values, 'draft');
    for (const legacy of ['highlights', 'challenge', 'next_steps', 'image_path', 'link_url']) {
      expect(row).not.toHaveProperty(legacy);
    }
  });

  it('publishes with published status', () => {
    expect(
      buildUpdateRow({ ...values, summary: 'Shipped V2', progress_types: ['Product'] }, 'publish')
        .status,
    ).toBe('published');
  });

  it('refuses to publish an incomplete update', () => {
    expect(() => buildUpdateRow(values, 'publish')).toThrow();
  });

  it('only quick-publishes complete drafts', () => {
    expect(canQuickPublish({ summary: 'Done', progress_types: ['Team'] })).toBe(true);
    expect(canQuickPublish({ summary: 'Done', progress_types: [] })).toBe(false);
    expect(canQuickPublish({ summary: ' ', progress_types: ['Team'] })).toBe(false);
  });
});
