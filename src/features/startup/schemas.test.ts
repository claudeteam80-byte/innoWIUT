import { describe, expect, it } from 'vitest';
import { issues } from '@/test/zod';
import { startupProfileSchema, teamMemberSchema } from './schemas';

const profile = {
  name: 'Gamma Labs',
  tagline: 'Adaptive learning',
  description: '',
  industry: 'EdTech',
  stage: 'MVP',
  website: 'gamma.uz',
  founded_year: '2024',
  team_size: '5',
  main_goal: 'Grow',
  biggest_challenge: 'Hiring',
} as const;

describe('startupProfileSchema', () => {
  it('parses and normalises a valid profile', () => {
    expect(startupProfileSchema.parse(profile)).toMatchObject({
      website: 'https://gamma.uz',
      founded_year: 2024,
      team_size: 5,
      description: null,
    });
  });

  it('requires goal and challenge', () => {
    expect(
      issues(startupProfileSchema.safeParse({ ...profile, main_goal: '', biggest_challenge: ' ' })),
    ).toEqual({
      main_goal: 'Add your current main goal.',
      biggest_challenge: 'Add your biggest current challenge.',
    });
  });

  it('rejects invalid website and long names', () => {
    const result = startupProfileSchema.safeParse({
      ...profile,
      website: 'not a site',
      name: 'x'.repeat(121),
    });
    expect(Object.keys(issues(result)).sort()).toEqual(['name', 'website']);
  });
});

describe('teamMemberSchema', () => {
  it('needs a name; other fields optional', () => {
    expect(teamMemberSchema.parse({ name: 'Aziz', role: '', email: '', linkedin_url: '' })).toEqual(
      {
        name: 'Aziz',
        role: null,
        email: null,
        linkedin_url: null,
      },
    );
    expect(
      issues(teamMemberSchema.safeParse({ name: '', role: '', email: 'bad', linkedin_url: '' })),
    ).toEqual({
      name: "Enter your teammate's name.",
      email: 'Enter a valid email address.',
    });
  });
});
