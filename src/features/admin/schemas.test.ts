import { describe, expect, it } from 'vitest';
import { localToday } from '@/domain/form-fields';
import { issues } from '@/test/zod';
import { meetingUpdateSchema, mentorNoteSchema, mentorSchema } from './schemas';

const mentor = {
  name: ' Aziz Karimov ',
  title: '',
  email: 'Aziz@WIUT.uz',
  telegram: '@aziz_k',
  linkedin_url: 'linkedin.com/in/aziz',
  expertise: 'Growth, Fundraising, growth ,  , Product',
  bio: '',
  is_active: true,
};

describe('mentorSchema', () => {
  it('normalises a mentor', () => {
    expect(mentorSchema.parse(mentor)).toEqual({
      name: 'Aziz Karimov',
      title: null,
      email: 'aziz@wiut.uz',
      telegram: '@aziz_k',
      linkedin_url: 'https://linkedin.com/in/aziz',
      expertise: ['Growth', 'Fundraising', 'growth', 'Product'],
      bio: null,
      is_active: true,
    });
  });

  it('requires a name and at least one area of expertise', () => {
    expect(issues(mentorSchema.safeParse({ ...mentor, name: '', expertise: ' , ' }))).toEqual({
      name: "Enter the mentor's full name.",
      expertise: 'Add at least one area of expertise.',
    });
  });

  it('validates optional contact fields', () => {
    const result = mentorSchema.safeParse({
      ...mentor,
      email: 'nope',
      telegram: 'has spaces',
      linkedin_url: 'x',
    });
    expect(Object.keys(issues(result)).sort()).toEqual(['email', 'linkedin_url', 'telegram']);
  });

  it('lets every contact field be empty', () => {
    expect(
      mentorSchema.parse({ ...mentor, email: '', telegram: '', linkedin_url: '' }),
    ).toMatchObject({
      email: null,
      telegram: null,
      linkedin_url: null,
    });
  });
});

describe('mentorNoteSchema', () => {
  it('requires the note text and a past or current date', () => {
    expect(
      mentorNoteSchema.safeParse({ body: 'Focus on retention.', note_date: localToday() }).success,
    ).toBe(true);
    expect(issues(mentorNoteSchema.safeParse({ body: ' ', note_date: '2999-01-01' }))).toEqual({
      body: 'Write the guidance the founder should see.',
      note_date: 'The date cannot be in the future.',
    });
  });
});

describe('meetingUpdateSchema', () => {
  it('accepts the four admin statuses with an optional note', () => {
    for (const status of ['requested', 'confirmed', 'completed', 'declined']) {
      expect(meetingUpdateSchema.parse({ status, admin_response: '' })).toEqual({
        status,
        admin_response: null,
      });
    }
  });

  it('rejects other statuses', () => {
    expect(
      issues(meetingUpdateSchema.safeParse({ status: 'cancelled', admin_response: '' })),
    ).toEqual({
      status: 'Choose a status.',
    });
  });
});
