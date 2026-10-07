import { describe, expect, it } from 'vitest';
import { issues } from '@/test/zod';
import {
  aboutYouSchema,
  buildOnboardingPayload,
  emptyOnboardingValues,
  progressSchema,
  startupStepSchema,
  type OnboardingFormValues,
} from './schemas';

const complete: OnboardingFormValues = {
  ...emptyOnboardingValues(),
  full_name: '  Dilnoza Yusupova ',
  phone: '+998 90 123 45 67',
  linkedin_url: 'linkedin.com/in/dilnoza',
  role_in_startup: 'CEO',
  name: 'Gamma Labs',
  tagline: 'Adaptive learning for IELTS',
  description: '',
  industry: 'EdTech',
  stage: 'MVP',
  website: '',
  founded_year: '2025',
  team_size: '4',
  has_product: 'yes',
  has_users: 'yes',
  current_users: '320',
  has_revenue: 'yes',
  monthly_revenue: '1500000',
  revenue_currency: 'UZS',
  main_goal: 'Reach 1,000 learners',
  biggest_challenge: 'Content production',
};

describe('step 1 — about you', () => {
  it('requires name, phone and role; LinkedIn is optional', () => {
    expect(issues(aboutYouSchema.safeParse(emptyOnboardingValues()))).toEqual({
      full_name: 'Enter your full name.',
      phone: 'Enter your phone number.',
      role_in_startup: 'Choose your role.',
    });
  });

  it('validates the phone and LinkedIn formats', () => {
    const result = aboutYouSchema.safeParse({
      ...complete,
      phone: 'call me',
      linkedin_url: 'not a url',
    });
    expect(issues(result)).toEqual({
      phone: 'Enter a valid phone number, e.g. +998 90 123 45 67.',
      linkedin_url: 'Enter a valid LinkedIn URL.',
    });
  });

  it('normalises LinkedIn to https', () => {
    expect(aboutYouSchema.parse(complete).linkedin_url).toBe('https://linkedin.com/in/dilnoza');
  });
});

describe('step 2 — startup information', () => {
  it('requires the core startup fields', () => {
    expect(
      Object.keys(issues(startupStepSchema.safeParse(emptyOnboardingValues()))).sort(),
    ).toEqual(['founded_year', 'industry', 'name', 'stage', 'tagline', 'team_size'].sort());
  });

  it('checks year and team size ranges', () => {
    const nextYear = String(new Date().getFullYear() + 1);
    const result = startupStepSchema.safeParse({
      ...complete,
      founded_year: nextYear,
      team_size: '0',
    });
    expect(Object.keys(issues(result)).sort()).toEqual(['founded_year', 'team_size']);
    expect(
      issues(startupStepSchema.safeParse({ ...complete, team_size: '2.5' })).team_size,
    ).toMatch(/whole number/);
  });

  it('only accepts the five stages', () => {
    expect(issues(startupStepSchema.safeParse({ ...complete, stage: 'Series A' })).stage).toBe(
      'Choose a stage.',
    );
  });
});

describe('step 3 — conditional progress fields', () => {
  it('requires every yes/no answer, the goal and the challenge', () => {
    expect(Object.keys(issues(progressSchema.safeParse(emptyOnboardingValues()))).sort()).toEqual(
      ['biggest_challenge', 'has_product', 'has_revenue', 'has_users', 'main_goal'].sort(),
    );
  });

  it('requires a user count only when they have users', () => {
    const base = { ...complete, has_revenue: 'no' as const };
    expect(
      issues(progressSchema.safeParse({ ...base, has_users: 'yes', current_users: '' })),
    ).toEqual({
      current_users: 'Enter your current number of users.',
    });
    expect(progressSchema.safeParse({ ...base, has_users: 'no', current_users: '' }).success).toBe(
      true,
    );
    expect(issues(progressSchema.safeParse({ ...base, current_users: '12.5' })).current_users).toBe(
      'Use a whole number.',
    );
  });

  it('requires revenue and currency only when they have revenue', () => {
    const base = { ...complete, has_users: 'no' as const };
    expect(
      issues(
        progressSchema.safeParse({
          ...base,
          has_revenue: 'yes',
          monthly_revenue: '',
          revenue_currency: '',
        }),
      ),
    ).toEqual({
      monthly_revenue: 'Enter your current monthly revenue.',
      revenue_currency: 'Choose a currency.',
    });
    expect(
      progressSchema.safeParse({
        ...base,
        has_revenue: 'no',
        monthly_revenue: '',
        revenue_currency: '',
      }).success,
    ).toBe(true);
  });

  it('rejects negative numbers', () => {
    expect(
      issues(progressSchema.safeParse({ ...complete, monthly_revenue: '-5' })).monthly_revenue,
    ).toBe('Use zero or more.');
  });
});

describe('buildOnboardingPayload', () => {
  it('produces the complete_onboarding() payload', () => {
    expect(buildOnboardingPayload(complete)).toEqual({
      full_name: 'Dilnoza Yusupova',
      phone: '+998 90 123 45 67',
      linkedin_url: 'https://linkedin.com/in/dilnoza',
      role_in_startup: 'CEO',
      name: 'Gamma Labs',
      tagline: 'Adaptive learning for IELTS',
      description: null,
      industry: 'EdTech',
      stage: 'MVP',
      website: null,
      founded_year: 2025,
      team_size: 4,
      has_product: true,
      has_users: true,
      current_users: 320,
      has_revenue: true,
      monthly_revenue: 1500000,
      revenue_currency: 'UZS',
      main_goal: 'Reach 1,000 learners',
      biggest_challenge: 'Content production',
    });
  });

  it('drops conditional values when the answer is no', () => {
    const payload = buildOnboardingPayload({
      ...complete,
      has_users: 'no',
      has_revenue: 'no',
      current_users: '999',
      monthly_revenue: '5',
      revenue_currency: 'USD',
    });
    expect(payload).toMatchObject({
      current_users: null,
      monthly_revenue: null,
      revenue_currency: null,
    });
  });
});
