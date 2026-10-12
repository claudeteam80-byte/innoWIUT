import { describe, expect, it, vi } from 'vitest';
import type { ReadinessStateRow } from '@/domain/readiness';
import { reviewQueueArgs } from '@/features/reviews/api';
import { queueParamsFromSearch, searchFromQueueParams } from '@/features/reviews/queue-params';
import { parseInterview, toLocalInput } from './ui-helpers';
import { profilePatch, readinessProfileSchema, toProfileForm } from './schemas';
import { requirementValue, reusableEvidence, type ReadinessContext } from './values';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const emptyForm = toProfileForm(null);

describe('readiness profile form', () => {
  it('parses fundraising fields', () => {
    const parsed = readinessProfileSchema.parse({
      ...emptyForm,
      is_fundraising: 'yes',
      round_type: 'seed',
      target_raise: '250000',
      raise_currency: 'USD',
      runway_months: '9',
      use_of_funds: ' Hiring ',
    });
    expect(profilePatch('fundraising', parsed)).toEqual({
      is_fundraising: true,
      round_type: 'seed',
      target_raise: 250000,
      raise_currency: 'USD',
      use_of_funds: 'Hiring',
      runway_months: 9,
      previous_funding: null,
      round_outcome: null,
      valuation: null,
    });
  });

  it('requires a currency with a target raise and a positive amount', () => {
    const missing = readinessProfileSchema.safeParse({ ...emptyForm, target_raise: '1000' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['raise_currency']);
    const zero = readinessProfileSchema.safeParse({
      ...emptyForm,
      target_raise: '0',
      raise_currency: 'USD',
    });
    expect(zero.success).toBe(false);
  });

  it('rejects impossible runway', () => {
    expect(readinessProfileSchema.safeParse({ ...emptyForm, runway_months: '1.5' }).success).toBe(
      false,
    );
    expect(readinessProfileSchema.safeParse({ ...emptyForm, runway_months: '300' }).success).toBe(
      false,
    );
  });

  it('only sends the edited group and clears a blocker note without blockers', () => {
    const parsed = readinessProfileSchema.parse({
      ...emptyForm,
      company_registered: 'yes',
      has_legal_blockers: 'no',
      legal_blockers_note: 'old note',
    });
    const patch = profilePatch('legal', parsed);
    expect(Object.keys(patch)).not.toContain('target_raise');
    expect(patch).toMatchObject({ company_registered: true, legal_blockers_note: null });
  });
});

describe('interview form', () => {
  it('needs time and place unless no interview is required', () => {
    expect(
      parseInterview({ status: 'scheduled', scheduledAt: '', location: ' ', note: '' }),
    ).toEqual({
      ok: false,
      errors: {
        scheduledAt: 'Choose the date and time.',
        location: 'Add a place or a meeting link.',
      },
    });
    expect(
      parseInterview({ status: 'not_required', scheduledAt: '', location: '', note: ' x ' }),
    ).toEqual({ ok: true, scheduledAt: null, location: null, note: 'x' });
  });

  it('round-trips a local date and time', () => {
    const iso = new Date('2026-10-20T10:30').toISOString();
    expect(toLocalInput(iso)).toBe('2026-10-20T10:30');
    expect(
      parseInterview({
        status: 'completed',
        scheduledAt: '2026-10-20T10:30',
        location: 'Room 204',
        note: '',
      }),
    ).toEqual({ ok: true, scheduledAt: iso, location: 'Room 204', note: null });
  });
});

describe('readiness values (existing data, never copied)', () => {
  const row = (key: string, section: ReadinessStateRow['section'] = 'company') =>
    ({ requirement_id: `req-${key}`, requirement_key: key, section }) as ReadinessStateRow;
  const context: ReadinessContext = {
    startup: {
      name: 'Gamma Labs',
      tagline: 'Adaptive learning',
      industry: 'EdTech',
      founded_year: 2024,
      website: null,
    },
    profile: {
      target_raise: 250000,
      raise_currency: 'USD',
      is_fundraising: true,
      has_legal_blockers: false,
    } as ReadinessContext['profile'],
    requirements: [
      {
        id: 'req-pitch_deck',
        text_value: null,
        url: 'https://deck.example.com',
        linked_existing_evidence_id: 'ev-1',
      } as ReadinessContext['requirements'][number],
    ],
    evidence: [
      { id: 'ev-1', label: 'MVP demo', stage: 'mvp', update_id: null } as never,
      { id: 'ev-2', label: 'Update file', stage: 'mvp', update_id: 'u1' } as never,
    ],
    team: [{ id: 't1', commitment: 'full_time', relevant_experience: '' }],
    primaryMetricIds: ['m1', 'm2'],
  };

  it('reads company fields from the startup profile', () => {
    expect(requirementValue(row('startup_name'), context)).toBe('Gamma Labs');
    expect(requirementValue(row('website'), context)).toBeNull();
  });

  it('formats fundraising and legal values', () => {
    expect(requirementValue(row('target_raise', 'fundraising'), context)).toBe('$250,000');
    expect(requirementValue(row('legal_blockers', 'legal_operations'), context)).toBe('None');
  });

  it('links metrics, team and evidence rather than copying them', () => {
    expect(requirementValue(row('primary_investor_metrics', 'traction'), context)).toBe(
      '2 metrics selected',
    );
    expect(requirementValue(row('team_details', 'team'), context)).toBe(
      '0 of 1 team members complete',
    );
    expect(requirementValue(row('pitch_deck', 'investor_materials'), context)).toBe(
      'https://deck.example.com · Linked: MVP demo',
    );
    expect(reusableEvidence(context.evidence).map((e) => e.id)).toEqual(['ev-1']);
  });
});

describe('review queue type filter', () => {
  it('reads and writes the review type in the URL', () => {
    const params = queueParamsFromSearch(new URLSearchParams('type=investor_readiness'));
    expect(params.type).toBe('investor_readiness');
    expect(searchFromQueueParams(params).toString()).toBe('type=investor_readiness');
    expect(queueParamsFromSearch(new URLSearchParams('type=bogus')).type).toBe('');
    expect(queueParamsFromSearch(new URLSearchParams('stage=traction')).stage).toBe('traction');
  });

  it('passes the type to the database', () => {
    const base = queueParamsFromSearch(new URLSearchParams());
    expect(reviewQueueArgs(base).p_type).toBeUndefined();
    expect(reviewQueueArgs({ ...base, type: 'stage' }).p_type).toBe('stage');
  });
});
