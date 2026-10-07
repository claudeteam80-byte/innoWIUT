import { describe, expect, it } from 'vitest';
import { localToday } from '@/domain/form-fields';
import { issues } from '@/test/zod';
import { meetingRequestSchema } from './schemas';

describe('meetingRequestSchema', () => {
  it('requires a known reason', () => {
    expect(
      issues(meetingRequestSchema.safeParse({ reason: '', message: '', preferred_date: '' })),
    ).toEqual({
      reason: 'Choose a reason for the meeting.',
    });
  });

  it('treats message and date as optional', () => {
    expect(
      meetingRequestSchema.parse({ reason: 'Growth', message: ' ', preferred_date: '' }),
    ).toEqual({
      reason: 'Growth',
      message: null,
      preferred_date: null,
    });
  });

  it('accepts today and rejects past dates', () => {
    expect(
      meetingRequestSchema.safeParse({ reason: 'Team', message: '', preferred_date: localToday() })
        .success,
    ).toBe(true);
    expect(
      issues(
        meetingRequestSchema.safeParse({
          reason: 'Team',
          message: '',
          preferred_date: '2020-01-01',
        }),
      ),
    ).toEqual({ preferred_date: 'Choose today or a future date.' });
  });
});
