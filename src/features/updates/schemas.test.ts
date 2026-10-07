import { describe, expect, it } from 'vitest';
import { issues } from '@/test/zod';
import {
  buildUpdateRow,
  draftUpdateSchema,
  publishUpdateSchema,
  type UpdateFormValues,
} from './schemas';

const values: UpdateFormValues = {
  title: 'Weekly Update',
  summary: '',
  highlights: [{ text: 'Launched V2' }, { text: '  ' }],
  challenge: '',
  next_steps: 'Hire a designer',
  link_url: 'gamma.uz/v2',
};

describe('update schemas', () => {
  it('lets a draft be saved with only a title', () => {
    expect(draftUpdateSchema.safeParse(values).success).toBe(true);
    expect(issues(draftUpdateSchema.safeParse({ ...values, title: ' ' }))).toEqual({
      title: 'Give your update a title.',
    });
  });

  it('requires "What happened?" to publish', () => {
    expect(issues(publishUpdateSchema.safeParse(values))).toEqual({
      summary: 'Describe what happened before publishing.',
    });
  });

  it('validates the external link', () => {
    expect(issues(draftUpdateSchema.safeParse({ ...values, link_url: 'nope' }))).toEqual({
      link_url: 'Enter a valid link.',
    });
  });
});

describe('buildUpdateRow (draft / publish behaviour)', () => {
  it('saves drafts with draft status', () => {
    expect(buildUpdateRow(values, 'draft')).toEqual({
      title: 'Weekly Update',
      summary: null,
      highlights: ['Launched V2'],
      challenge: null,
      next_steps: 'Hire a designer',
      link_url: 'https://gamma.uz/v2',
      status: 'draft',
    });
  });

  it('publishes with published status', () => {
    expect(buildUpdateRow({ ...values, summary: 'Shipped V2' }, 'publish').status).toBe(
      'published',
    );
  });

  it('refuses to publish an incomplete update', () => {
    expect(() => buildUpdateRow(values, 'publish')).toThrow();
  });
});
