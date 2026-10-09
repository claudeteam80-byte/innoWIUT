import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { journeySummary, type StageRequirement } from '@/domain/journey';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import { CurrentStageCard, NextBestActionCard } from './components/CurrentStageCard';
import { JourneyPage } from './pages/JourneyPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const state = vi.hoisted(() => ({
  stage: 'validation' as string,
  requirements: [] as unknown[],
  evidence: [] as unknown[],
  metrics: [] as unknown[],
}));
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

  it('shows the investor stages as locked and not selectable', async () => {
    renderJourney();
    await screen.findByRole('list', { name: 'Journey stages' });
    expect(screen.getByLabelText('Investor Readiness — Locked')).toBeInTheDocument();
    expect(screen.getByLabelText('Investor Access — Locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Investor/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Investor Readiness and Investor Access open in a later V2 phase.'),
    ).toBeInTheDocument();
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
    expect(screen.getByText(/Your stage stays Validation until then/)).toBeInTheDocument();
    expect(document.getElementById('current-stage-title')).toHaveTextContent('02 · Validation');
    expect(api.updateRequirement).not.toHaveBeenCalled();
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
