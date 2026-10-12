import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { journeySummary, type StageRequirement } from '@/domain/journey';
import type { StageReview } from '@/domain/reviews';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import { CurrentStageCard, NextBestActionCard } from './components/CurrentStageCard';
import { JourneyPage } from './pages/JourneyPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const state = vi.hoisted(() => ({
  stage: 'validation' as string,
  requirements: [] as unknown[],
  evidence: [] as unknown[],
  metrics: [] as unknown[],
  reviews: [] as unknown[],
}));
const reviewApi = vi.hoisted(() => ({
  fetchStartupReviews: vi.fn(),
  requestStageReview: vi.fn(),
}));
vi.mock('@/features/reviews/api', () => reviewApi);
const api = vi.hoisted(() => ({
  fetchRequirements: vi.fn(),
  fetchEvidence: vi.fn(),
  updateRequirement: vi.fn(),
  saveTractionChoices: vi.fn(),
  addEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
}));
vi.mock('./api', () => api);
vi.mock('@/features/startup/hooks', () => ({
  useMyStartup: () => ({
    data: { id: 'startup-1', journey_stage: state.stage, stage: 'Validation' },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useTeam: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock('@/features/traction/hooks', () => ({
  useMetrics: () => ({ data: state.metrics, isPending: false, isError: false }),
  useEntries: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock('@/features/updates/hooks', () => ({
  useUpdates: () => ({ data: [], isPending: false, isError: false }),
  useUpdateContext: () => undefined,
  useSignedImageUrl: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}));

let seq = 0;
const req = (
  stage: string,
  key: string,
  title: string,
  overrides: Partial<StageRequirement> = {},
): StageRequirement => ({
  id: `r${++seq}`,
  startup_id: 'startup-1',
  stage: stage as StageRequirement['stage'],
  requirement_key: key,
  title,
  description: null,
  required: true,
  status: 'not_started',
  progress_value: null,
  progress_target: null,
  linked_metric_id: null,
  completed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...overrides,
});

const validation = (status: StageRequirement['status'] = 'not_started') => [
  req('validation', 'customer_interviews', 'Customer Interviews', {
    progress_value: 7,
    progress_target: 10,
    status: status === 'completed' ? 'completed' : 'in_progress',
  }),
  req('validation', 'problem_validation', 'Problem Validation', { status }),
  req('validation', 'customer_persona', 'Customer Persona', { status }),
  req('validation', 'competitor_research', 'Competitor Research', { status }),
  req('validation', 'pricing_willingness', 'Pricing / Willingness to Pay', { status }),
  req('validation', 'key_assumptions', 'Key Assumptions', { status }),
];

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
  state.stage = 'validation';
  state.requirements = validation();
  state.evidence = [];
  state.metrics = [];
  api.fetchRequirements.mockImplementation(async () => state.requirements);
  api.fetchEvidence.mockImplementation(async () => state.evidence);
  api.updateRequirement.mockResolvedValue(undefined);
  state.reviews = [];
  reviewApi.fetchStartupReviews.mockImplementation(async () => state.reviews);
  reviewApi.requestStageReview.mockImplementation(async () => {
    const pending = review({ id: 'new-review' });
    state.reviews = [pending];
    return pending;
  });
});

const review = (overrides: Partial<StageReview>): StageReview => ({
  id: 'rev-1',
  startup_id: 'startup-1',
  from_stage: 'validation',
  to_stage: 'mvp',
  status: 'pending',
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
  review_type: 'stage',
  created_at: '2026-10-10T09:00:00Z',
  ...overrides,
});

describe('JourneyPage', () => {
  it('shows the current stage, progress, requirements and the next action', async () => {
    renderJourney();
    const current = await screen.findByRole('region', { name: /^02/ });
    expect(within(current).getByText('0 of 6 requirements completed')).toBeInTheDocument();
    expect(within(current).getByText('Complete 3 more customer interviews')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customer Interviews' })).toBeInTheDocument();
    expect(screen.getByText('No evidence yet.')).toBeInTheDocument();
    expect(screen.getByText('No updates linked to this stage yet.')).toBeInTheDocument();
  });

  it('shows Investor Readiness as upcoming and Investor Access as locked', async () => {
    renderJourney();
    await screen.findByRole('list', { name: 'Journey stages' });
    expect(screen.getByLabelText('Investor Access — Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Investor Access/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Investor Access opens after innoWIUT approves your Investor Readiness.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Investor Readiness — Upcoming/ }));
    expect(await screen.findByText('Investor Readiness is an upcoming stage')).toBeInTheDocument();
    // Nothing can be entered before the stage is reached.
    expect(screen.queryByRole('button', { name: /Request Investor Readiness/ })).toBeNull();
  });

  it('falls back to the current stage for a locked stage URL', async () => {
    renderJourney('/founder/journey/investor_access');
    expect(
      await screen.findByRole('heading', { name: 'Validation', level: 2 }),
    ).toBeInTheDocument();
  });

  it('reports completed requirements without moving the stage', async () => {
    state.requirements = validation('completed');
    renderJourney();
    expect(await screen.findAllByText('Stage requirements completed')).not.toHaveLength(0);
    expect(
      screen.getByText(/Your stage stays Validation until innoWIUT approves a stage review/),
    ).toBeInTheDocument();
    expect(document.getElementById('current-stage-title')).toHaveTextContent('02 · Validation');
    expect(api.updateRequirement).not.toHaveBeenCalled();
  });

  it('offers a stage review once every requirement is complete, then shows it pending', async () => {
    const user = userEvent.setup();
    state.requirements = validation('completed');
    renderJourney();
    const card = await screen.findByRole('region', { name: 'Stage ready for review' });
    expect(
      within(card).getByText('You have completed all required milestones for Validation.'),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        /innoWIUT will review your progress before you move to the next stage/,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Request Validation review').length).toBeGreaterThan(0);
    await user.click(within(card).getByRole('button', { name: 'Request Stage Review' }));
    expect(reviewApi.requestStageReview).toHaveBeenCalledWith('startup-1');
    const pending = await screen.findByRole('region', { name: 'Stage review' });
    expect(within(pending).getByText('Pending Review')).toBeInTheDocument();
    expect(within(pending).getByRole('button', { name: 'Review Requested' })).toBeDisabled();
    expect(within(pending).getByText(/Requested October 10, 2026/)).toBeInTheDocument();
    expect(document.getElementById('current-stage-title')).toHaveTextContent('02 · Validation');
  });

  it('does not offer a review while requirements are open', async () => {
    renderJourney();
    await screen.findByRole('region', { name: /^02/ });
    expect(screen.queryByRole('button', { name: 'Request Stage Review' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Not Ready').length).toBeGreaterThan(0);
  });

  it('shows needs-work feedback, the requirements to revisit, and lets the founder resubmit', async () => {
    const user = userEvent.setup();
    state.requirements = validation('completed');
    const interviews = (state.requirements as StageRequirement[])[0]!;
    state.reviews = [
      review({
        status: 'needs_work',
        reviewed_at: '2026-10-11T10:00:00Z',
        reviewed_by: 'admin-1',
        reviewer_name: 'Aziza Admin',
        feedback: 'You need stronger customer validation evidence before moving to MVP.',
        attention_requirement_ids: [interviews.id],
      }),
    ];
    renderJourney();
    const card = await screen.findByRole('region', { name: 'Needs work' });
    expect(
      within(card).getByText(
        'You need stronger customer validation evidence before moving to MVP.',
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText(/Reviewed October 11, 2026 by Aziza Admin/)).toBeInTheDocument();
    expect(within(card).getByText('Customer Interviews')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Update Evidence' })).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getAllByText('Address innoWIUT feedback and resubmit').length).toBeGreaterThan(0);
    await user.click(within(card).getByRole('button', { name: 'Resubmit for Review' }));
    expect(reviewApi.requestStageReview).toHaveBeenCalledWith('startup-1');
    // History keeps the needs-work decision.
    const history = screen.getByRole('list', { name: 'Review history' });
    expect(within(history).getByText('Validation → MVP')).toBeInTheDocument();
  });

  it('shows a short approved state after advancing, without the old stage', async () => {
    state.stage = 'mvp';
    state.requirements = [
      ...validation('completed'),
      req('mvp', 'working_mvp', 'Working MVP'),
      req('mvp', 'product_url', 'Product URL'),
    ];
    state.reviews = [
      review({
        status: 'approved',
        reviewed_at: new Date(Date.now() - 86_400_000).toISOString(),
        reviewer_name: 'Aziza Admin',
      }),
    ];
    renderJourney();
    const card = await screen.findByRole('region', { name: 'Stage approved' });
    expect(within(card).getByText('Validation completed')).toBeInTheDocument();
    expect(within(card).getByText('MVP')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Continue to MVP/ })).toBeInTheDocument();
    expect(document.getElementById('current-stage-title')).toHaveTextContent('03 · MVP');
    const history = screen.getByRole('list', { name: 'Review history' });
    expect(within(history).getByText('Approved')).toBeInTheDocument();
    expect(within(history).getByText(/Reviewed by innoWIUT/)).toBeInTheDocument();
  });

  it('asks a traction founder to choose their metrics', async () => {
    state.stage = 'traction';
    state.requirements = [];
    renderJourney();
    expect(await screen.findByText('No traction metrics selected yet.')).toBeInTheDocument();
    expect(
      screen.getAllByText('Choose the traction metrics that matter for your business').length,
    ).toBeGreaterThan(0);
  });

  it('saves requirement progress', async () => {
    const user = userEvent.setup();
    renderJourney();
    const row = (await screen.findByRole('heading', { name: 'Problem Validation' })).closest('li')!;
    await user.click(within(row).getByRole('button', { name: /Update/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Problem Validation' });
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'ready_for_review');
    await user.click(within(dialog).getByRole('button', { name: 'Save Progress' }));
    const target = state.requirements[1] as StageRequirement;
    await vi.waitFor(() =>
      expect(api.updateRequirement).toHaveBeenCalledWith(target.id, { status: 'ready_for_review' }),
    );
  });
});

describe('Dashboard journey cards', () => {
  it('shows current stage, completed requirements, next action and a deterministic next best action', () => {
    const rows = validation();
    const summary = journeySummary('validation', rows);
    render(
      <>
        <CurrentStageCard
          summary={summary}
          action={<a href="/founder/journey">Continue Journey</a>}
        />
        <NextBestActionCard summary={summary} />
      </>,
    );
    expect(screen.getByText('Current stage')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Validation progress' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.getAllByText('Complete 3 more customer interviews')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Continue Journey' })).toBeInTheDocument();
    expect(journeySummary('validation', [...rows].reverse()).next).toEqual(summary.next);
  });
});
