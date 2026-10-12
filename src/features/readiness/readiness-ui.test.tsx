import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadinessStateRow } from '@/domain/readiness';
import type { StageReview } from '@/domain/reviews';
import { JourneyPage } from '@/features/journey/pages/JourneyPage';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const state = vi.hoisted(() => ({
  stage: 'investor_readiness' as string,
  rows: [] as unknown[],
  requirements: [] as unknown[],
  profile: null as unknown,
  metricIds: [] as string[],
  interview: null as unknown,
  reviews: [] as unknown[],
  metrics: [] as unknown[],
  entries: [] as unknown[],
  team: [] as unknown[],
}));

const readinessApi = vi.hoisted(() => ({
  fetchReadinessState: vi.fn(),
  fetchReadinessRequirements: vi.fn(),
  fetchReadinessProfile: vi.fn(),
  fetchReadinessMetrics: vi.fn(),
  fetchInterview: vi.fn(),
  fetchAdminInterview: vi.fn(),
  fetchReadinessStats: vi.fn(),
  updateReadinessRequirement: vi.fn(),
  updateReadinessProfile: vi.fn(),
  savePrimaryMetrics: vi.fn(),
  requestReadinessReview: vi.fn(),
  setInterview: vi.fn(),
}));
vi.mock('@/features/readiness/api', () => readinessApi);
const reviewApi = vi.hoisted(() => ({
  fetchStartupReviews: vi.fn(),
  requestStageReview: vi.fn(),
}));
vi.mock('@/features/reviews/api', () => reviewApi);
vi.mock('@/features/journey/api', () => ({
  fetchRequirements: async () => [],
  fetchEvidence: async () => [],
  updateRequirement: vi.fn(),
  saveTractionChoices: vi.fn(),
  addEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
}));
vi.mock('@/features/startup/hooks', () => ({
  useMyStartup: () => ({
    data: {
      id: 'startup-1',
      journey_stage: state.stage,
      name: 'Gamma Labs',
      tagline: 'Adaptive learning for schools',
      industry: 'EdTech',
      founded_year: 2024,
      website: 'https://gamma.uz',
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useTeam: () => ({ data: state.team, isPending: false, isError: false }),
}));
vi.mock('@/features/traction/hooks', () => ({
  useMetrics: () => ({ data: state.metrics, isPending: false, isError: false }),
  useEntries: () => ({ data: state.entries, isPending: false, isError: false }),
}));
vi.mock('@/features/updates/hooks', () => ({
  useUpdates: () => ({ data: [], isPending: false, isError: false }),
  useUpdateContext: () => undefined,
  useSignedImageUrl: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}));

let order = 0;
const row = (
  key: string,
  section: ReadinessStateRow['section'],
  title: string,
  overrides: Partial<ReadinessStateRow> = {},
): ReadinessStateRow => ({
  requirement_id: `req-${key}`,
  section,
  requirement_key: key,
  title,
  description: `${title} description`,
  required: true,
  input_kind: 'text',
  allows_not_applicable: false,
  sort_order: ++order,
  not_applicable: false,
  is_complete: false,
  ...overrides,
});

const stateRows = (complete = false) => [
  row('startup_name', 'company', 'Startup Name', { input_kind: 'derived', is_complete: true }),
  row('problem_statement', 'problem_market', 'Problem Statement', {
    input_kind: 'text_or_evidence',
    is_complete: complete,
  }),
  row('primary_investor_metrics', 'traction', 'Primary Investor Metrics', {
    input_kind: 'derived',
    is_complete: true,
  }),
  row('unit_economics', 'business_model', 'Unit Economics', {
    allows_not_applicable: true,
    is_complete: complete,
  }),
  row('target_raise', 'fundraising', 'Target Raise', { input_kind: 'derived', is_complete: true }),
  row('pitch_deck', 'investor_materials', 'Pitch Deck', {
    input_kind: 'link_or_file',
    is_complete: complete,
  }),
];

const ownRow = (r: ReadinessStateRow) => ({
  id: r.requirement_id,
  startup_id: 'startup-1',
  section: r.section,
  requirement_key: r.requirement_key,
  title: r.title,
  description: r.description,
  required: r.required,
  input_kind: r.input_kind,
  allows_not_applicable: r.allows_not_applicable,
  sort_order: r.sort_order,
  status: 'not_started',
  text_value: null,
  url: null,
  linked_metric_id: null,
  linked_team_member_id: null,
  linked_existing_evidence_id: null,
  not_applicable: false,
  not_applicable_reason: null,
  completed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});

const metric = {
  id: 'm-users',
  startup_id: 'startup-1',
  name: 'Active Users',
  unit: 'number',
  currency: null,
  current_value: 1240,
  previous_value: 1000,
  last_recorded_on: '2026-10-01',
  target: null,
  note: null,
  is_archived: false,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const review = (overrides: Partial<StageReview>): StageReview => ({
  id: 'rev-r1',
  startup_id: 'startup-1',
  from_stage: 'investor_readiness',
  to_stage: 'investor_access',
  status: 'pending',
  review_type: 'investor_readiness',
  requirements_completed: 6,
  requirements_total: 6,
  requested_by: 'founder-user-id',
  requested_at: '2026-10-10T09:00:00Z',
  reviewed_by: null,
  reviewer_name: null,
  reviewed_at: null,
  feedback: null,
  admin_note: null,
  attention_requirement_ids: [],
  attention_sections: [],
  created_at: '2026-10-10T09:00:00Z',
  ...overrides,
});

function renderJourney(path = '/founder/journey') {
  const router = createMemoryRouter(
    [
      { path: '/founder/journey', element: <JourneyPage /> },
      { path: '/founder/journey/:stage', element: <JourneyPage /> },
      { path: '*', element: <p>Elsewhere</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestProviders auth={signedInAs('founder')}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  order = 0;
  state.stage = 'investor_readiness';
  state.rows = stateRows();
  state.requirements = (state.rows as ReadinessStateRow[]).map(ownRow);
  state.profile = {
    startup_id: 'startup-1',
    is_fundraising: true,
    round_type: 'seed',
    target_raise: 250000,
    raise_currency: 'USD',
    updated_at: '2026-10-01T00:00:00Z',
  };
  state.metricIds = ['m-users'];
  state.interview = null;
  state.reviews = [];
  state.metrics = [metric];
  state.entries = [
    { id: 'e1', metric_id: 'm-users', value: 1000, recorded_on: '2026-09-01', created_at: '' },
    { id: 'e2', metric_id: 'm-users', value: 1240, recorded_on: '2026-10-01', created_at: '' },
  ];
  state.team = [];
  readinessApi.fetchReadinessState.mockImplementation(async () => state.rows);
  readinessApi.fetchReadinessRequirements.mockImplementation(async () => state.requirements);
  readinessApi.fetchReadinessProfile.mockImplementation(async () => state.profile);
  readinessApi.fetchReadinessMetrics.mockImplementation(async () => state.metricIds);
  readinessApi.fetchInterview.mockImplementation(async () => state.interview);
  readinessApi.updateReadinessRequirement.mockResolvedValue(undefined);
  reviewApi.fetchStartupReviews.mockImplementation(async () => state.reviews);
  readinessApi.requestReadinessReview.mockImplementation(async () => {
    const pending = review({});
    state.reviews = [pending];
    return pending;
  });
});

describe('Investor Readiness (founder)', () => {
  it('shows readiness completion, sections, requirements and the next action', async () => {
    renderJourney();
    const card = await screen.findByRole('region', { name: /^05/ });
    expect(within(card).getByText(/3 of 6 mandatory requirements/)).toBeInTheDocument();
    expect(screen.getAllByText('50% complete').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Upload pitch deck').length).toBeGreaterThan(0);
    expect(screen.getByRole('list', { name: 'Readiness sections' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pitch Deck' })).toBeInTheDocument();
    // Never a score.
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Request Investor Readiness Review' }),
    ).toBeDisabled();
  });

  it('shows primary metrics from traction: current, previous, calculated change, history', async () => {
    renderJourney();
    await screen.findByRole('heading', { name: 'Primary Investor Metrics' });
    const traction = document.getElementById('readiness-traction')!;
    expect(within(traction).getByText('1,240')).toBeInTheDocument();
    expect(within(traction).getByText(/Previous 1,000/)).toBeInTheDocument();
    expect(within(traction).getByText('+24%')).toBeInTheDocument();
    expect(within(traction).getByText('History: 1,000 → 1,240')).toBeInTheDocument();
  });

  it('uses existing startup data instead of asking for it again', async () => {
    renderJourney();
    await screen.findByRole('heading', { name: 'Startup Name' });
    const company = document.getElementById('readiness-company')!;
    expect(within(company).getByText('Gamma Labs')).toBeInTheDocument();
    expect(within(company).getByText('From your startup profile')).toBeInTheDocument();
    expect(within(company).getByRole('link', { name: /Startup profile/ })).toHaveAttribute(
      'href',
      '/founder/startup',
    );
    expect(screen.getByText('$250,000')).toBeInTheDocument();
  });

  it('marks a requirement not applicable only with a reason', async () => {
    renderJourney();
    await userEvent.click(await screen.findByRole('button', { name: 'Update Unit Economics' }));
    const dialog = await screen.findByRole('dialog', { name: 'Unit Economics' });
    await userEvent.click(within(dialog).getByLabelText('Not applicable to my startup'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Add a short reason.')).toBeInTheDocument();
    expect(readinessApi.updateReadinessRequirement).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/Why it does not apply/), 'Pre-revenue');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(readinessApi.updateReadinessRequirement).toHaveBeenCalledWith(
      'req-unit_economics',
      expect.objectContaining({ not_applicable: true, not_applicable_reason: 'Pre-revenue' }),
    );
  });

  it('requests the readiness review once everything is complete, then shows it pending', async () => {
    state.rows = stateRows(true);
    renderJourney();
    const request = await screen.findByRole('button', {
      name: 'Request Investor Readiness Review',
    });
    expect(request).toBeEnabled();
    await userEvent.click(request);
    expect(readinessApi.requestReadinessReview).toHaveBeenCalledWith('startup-1');
    expect(await screen.findByText('Your Investor Readiness is under review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Requested' })).toBeDisabled();
  });

  it('shows Needs Work feedback with flagged sections and requirements', async () => {
    state.rows = stateRows(true);
    state.reviews = [
      review({
        status: 'needs_work',
        feedback: 'Add a financial model.',
        attention_sections: ['investor_materials'],
        attention_requirement_ids: ['req-pitch_deck'],
        reviewed_at: '2026-10-11T09:00:00Z',
        reviewer_name: 'Admin',
      }),
    ];
    renderJourney();
    expect(await screen.findByText('Add a financial model.')).toBeInTheDocument();
    const feedback = screen.getByRole('region', { name: 'Needs work' });
    expect(within(feedback).getByText('Investor Materials')).toBeInTheDocument();
    expect(within(feedback).getByText('Pitch Deck')).toBeInTheDocument();
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Address innoWIUT feedback').length).toBeGreaterThan(0);
    const resubmit = screen.getByRole('button', { name: 'Resubmit for Review' });
    await userEvent.click(resubmit);
    expect(readinessApi.requestReadinessReview).toHaveBeenCalledTimes(1);
  });

  it('shows a scheduled interview read-only', async () => {
    state.rows = stateRows(true);
    state.reviews = [review({})];
    state.interview = {
      id: 'i1',
      startup_id: 'startup-1',
      status: 'scheduled',
      scheduled_at: '2026-10-20T10:00:00Z',
      location_or_link: 'https://meet.example.com/abc',
      completed_at: null,
    };
    renderJourney();
    const card = await screen.findByRole('region', { name: 'Readiness interview' });
    expect(within(card).getByText('Scheduled')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'https://meet.example.com/abc' })).toBeVisible();
    expect(within(card).queryByRole('button')).toBeNull();
    expect(screen.getAllByText('Attend scheduled interview').length).toBeGreaterThan(0);
  });

  it('after Investor Ready, shows Investor Access unlocked with Coming Soon only', async () => {
    state.stage = 'investor_access';
    state.rows = stateRows(true);
    state.reviews = [
      review({ status: 'approved', reviewed_at: '2026-10-12T09:00:00Z', reviewer_name: 'A' }),
    ];
    renderJourney();
    const access = await screen.findByRole('region', { name: 'Investor Access' });
    expect(within(access).getByText('Unlocked')).toBeInTheDocument();
    expect(
      within(access).getByText('Investor introductions will be available in the next stage.'),
    ).toBeInTheDocument();
    expect(within(access).getByRole('button', { name: 'Coming Soon' })).toBeDisabled();
    expect(screen.getAllByText('Investor Ready').length).toBeGreaterThan(0);
    // No investor functionality.
    expect(screen.queryByText(/directory|matching|introduce me|message investor/i)).toBeNull();
    // Readiness stays visible read-only.
    await userEvent.click(screen.getByRole('button', { name: /^Investor Readiness — Earlier/ }));
    expect(await screen.findByRole('heading', { name: 'Pitch Deck' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Update / })).toBeNull();
  });
});
