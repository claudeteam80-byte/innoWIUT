import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import type { StartupUpdate } from './api';
import { UpdateCard } from './components/UpdateCard';
import { UpdatesPage } from './pages/UpdatesPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const state = vi.hoisted(() => ({
  updates: [] as unknown[],
  metrics: [] as unknown[],
  entries: [] as unknown[],
}));
const api = vi.hoisted(() => ({
  publishDraft: vi.fn(),
  deleteDraft: vi.fn(),
  createUpdate: vi.fn(),
  editUpdate: vi.fn(),
  fetchUpdates: vi.fn(),
}));
const journeyApi = vi.hoisted(() => ({
  addEvidence: vi.fn(),
  deleteEvidence: vi.fn(),
  fetchEvidence: vi.fn(),
  fetchRequirements: vi.fn(),
}));
vi.mock('@/features/journey/api', () => journeyApi);
vi.mock('@/features/journey/hooks', () => ({
  useRequirements: () => ({ data: [], isPending: false, isError: false }),
  useEvidence: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock('@/features/traction/hooks', () => ({
  useMetrics: () => ({ data: state.metrics, isPending: false, isError: false }),
  useEntries: () => ({ data: state.entries, isPending: false, isError: false }),
}));
vi.mock('@/features/startup/hooks', () => ({
  useMyStartup: () => ({
    data: { id: 'startup-1', journey_stage: 'mvp' },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('./hooks', () => ({
  useUpdateContext: () => undefined,
  useUpdates: () => ({ data: state.updates, isPending: false, isError: false, refetch: vi.fn() }),
  useSignedImageUrl: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('./api', () => api);

const update = (overrides: Partial<StartupUpdate>): StartupUpdate => ({
  id: 'u1',
  startup_id: 'startup-1',
  author_id: null,
  title: 'Weekly Update',
  summary: 'Shipped V2',
  highlights: ['Signed a pilot'],
  challenge: null,
  next_steps: null,
  image_path: null,
  link_url: null,
  status: 'draft',
  update_date: '2026-10-01',
  published_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  progress_types: ['Product'],
  blocker: null,
  next_milestone: null,
  next_milestone_date: null,
  linked_stage: null,
  ...overrides,
});

function renderPage() {
  render(
    <TestProviders auth={signedInAs('founder')}>
      <MemoryRouter>
        <UpdatesPage />
      </MemoryRouter>
    </TestProviders>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.publishDraft.mockResolvedValue(undefined);
  journeyApi.addEvidence.mockResolvedValue(undefined);
  journeyApi.deleteEvidence.mockResolvedValue(undefined);
  state.updates = [];
  state.metrics = [];
  state.entries = [];
});

describe('UpdatesPage', () => {
  it('shows the empty state with a Create Update call to action', () => {
    renderPage();
    expect(screen.getByText('No updates yet')).toBeInTheDocument();
    expect(screen.getByText('Share your first progress update with innoWIUT.')).toBeInTheDocument();
  });

  it('only offers edit, publish and delete on drafts', () => {
    state.updates = [
      update({ id: 'd1', title: 'Draft note', status: 'draft' }),
      update({
        id: 'p1',
        title: 'Shipped',
        status: 'published',
        published_at: '2026-10-02T00:00:00Z',
      }),
    ];
    renderPage();
    const [draft, published] = screen.getAllByRole('article');
    expect(within(draft!).getByRole('button', { name: /Edit draft/ })).toBeInTheDocument();
    expect(within(draft!).getByRole('button', { name: /Delete draft/ })).toBeInTheDocument();
    expect(within(published!).queryByRole('button')).not.toBeInTheDocument();
    expect(within(published!).getByText('Published')).toBeInTheDocument();
  });

  it('publishes a complete draft', async () => {
    const user = userEvent.setup();
    state.updates = [update({ id: 'd1' })];
    renderPage();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    expect(api.publishDraft).toHaveBeenCalledWith('d1');
  });

  it('opens the editor instead of publishing a draft without "What moved?"', async () => {
    const user = userEvent.setup();
    state.updates = [update({ id: 'd1', summary: null })];
    renderPage();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    expect(api.publishDraft).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Edit draft' })).toBeInTheDocument();
  });

  it('opens the editor for a V1 draft that has no progress type yet', async () => {
    const user = userEvent.setup();
    state.updates = [update({ id: 'd1', progress_types: [] })];
    renderPage();
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));
    expect(api.publishDraft).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Edit draft' })).toBeInTheDocument();
  });

  it('filters by tab', async () => {
    const user = userEvent.setup();
    state.updates = [
      update({ id: 'd1', title: 'Draft note' }),
      update({ id: 'p1', title: 'Shipped', status: 'published' }),
    ];
    renderPage();
    await user.click(screen.getByRole('tab', { name: /Drafts/ }));
    expect(screen.getByText('Draft note')).toBeInTheDocument();
    expect(screen.queryByText('Shipped')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Published/ }));
    expect(screen.getByText('Shipped')).toBeInTheDocument();
    expect(screen.queryByText('Draft note')).not.toBeInTheDocument();
  });
});

describe('UpdateDialog (structured composer)', () => {
  it('saves a draft with only a headline, then publishes with what moved, type and traction', async () => {
    const user = userEvent.setup();
    state.metrics = [
      { id: 'm1', name: 'Active Users', unit: 'number', currency: null, is_archived: false },
    ];
    state.entries = [
      {
        metric_id: 'm1',
        value: 100,
        recorded_on: '2026-09-01',
        created_at: '2026-09-01T00:00:00Z',
      },
      {
        metric_id: 'm1',
        value: 150,
        recorded_on: '2026-09-08',
        created_at: '2026-09-08T00:00:00Z',
      },
    ];
    api.createUpdate.mockImplementation(async (_startupId: string, row: object) => ({
      ...update({ id: 'new-1' }),
      ...row,
    }));
    renderPage();
    await user.click(screen.getAllByRole('button', { name: /Create Update/ })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New update' });
    expect(within(dialog).getByText('1 · What moved?')).toBeInTheDocument();
    expect(within(dialog).getByText('7 · Linked stage')).toBeInTheDocument();
    // Linked stage defaults to the startup's current journey stage.
    expect(within(dialog).getByLabelText('Linked stage')).toHaveValue('mvp');
    await user.click(within(dialog).getByRole('button', { name: 'Save Draft' }));
    await vi.waitFor(() => expect(api.createUpdate).toHaveBeenCalledTimes(1));
    expect(api.createUpdate.mock.calls[0]![1]).toMatchObject({
      status: 'draft',
      summary: null,
      progress_types: [],
      linked_stage: 'mvp',
    });
    expect(api.publishDraft).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: /Create Update/ })[0]!);
    const second = await screen.findByRole('dialog', { name: 'New update' });
    await user.click(within(second).getByRole('button', { name: 'Publish Update' }));
    expect(
      await within(second).findByText('Describe what moved before publishing.'),
    ).toBeInTheDocument();
    expect(within(second).getByText('Choose at least one progress type.')).toBeInTheDocument();

    // Traction movement is read from history: 100 → 150, +50%. No number is typed.
    const traction = within(second).getByText('Active Users').closest('label')!;
    expect(traction).toHaveTextContent('100 → 150');
    expect(traction).toHaveTextContent('+50%');
    await user.click(within(traction).getByRole('checkbox'));

    await user.type(
      within(second).getByLabelText(/What meaningfully changed/),
      'Launched onboarding',
    );
    await user.click(within(second).getByRole('button', { name: 'Product' }));
    await user.type(within(second).getByLabelText(/currently slowing you down/), 'Hiring');
    await user.type(within(second).getByLabelText(/aiming for next/), 'Reach 1,000 users');
    await user.click(within(second).getByRole('button', { name: 'Publish Update' }));

    await vi.waitFor(() => expect(api.publishDraft).toHaveBeenCalledWith('new-1'));
    // Saved as a draft first, evidence attached, then published.
    expect(api.createUpdate.mock.calls[1]![1]).toMatchObject({
      status: 'draft',
      summary: 'Launched onboarding',
      progress_types: ['Product'],
      blocker: 'Hiring',
      next_milestone: 'Reach 1,000 users',
      linked_stage: 'mvp',
    });
    expect(journeyApi.addEvidence).toHaveBeenLastCalledWith('startup-1', [
      {
        stage: 'mvp',
        update_id: 'new-1',
        evidence_type: 'metric',
        label: 'Active Users',
        linked_metric_id: 'm1',
      },
    ]);
  });
});

describe('UpdateCard', () => {
  it('renders a V1 update exactly as written', () => {
    render(
      <MemoryRouter>
        <UpdateCard
          update={update({
            status: 'published',
            progress_types: [],
            highlights: ['Signed a pilot'],
            challenge: 'Hiring engineers',
            next_steps: 'Launch V3',
            link_url: 'https://gamma.uz',
          })}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    expect(screen.getByText('Signed a pilot')).toBeInTheDocument();
    expect(screen.getByText('Challenges')).toBeInTheDocument();
    expect(screen.getByText('Hiring engineers')).toBeInTheDocument();
    expect(screen.getByText('Next steps')).toBeInTheDocument();
    expect(screen.getByText('Launch V3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'gamma.uz' })).toBeInTheDocument();
    expect(screen.queryByText('Blocker')).not.toBeInTheDocument();
  });

  it('renders structured fields, evidence and traction movement from history', () => {
    render(
      <MemoryRouter>
        <UpdateCard
          update={update({
            id: 'u9',
            status: 'published',
            update_date: '2026-09-10',
            highlights: [],
            progress_types: ['Product', 'Traction'],
            blocker: 'Payment integration',
            next_milestone: 'Reach 1,000 users',
            next_milestone_date: '2026-11-30',
            linked_stage: 'mvp',
          })}
          context={{
            evidence: [
              {
                id: 'e1',
                startup_id: 'startup-1',
                requirement_id: null,
                update_id: 'u9',
                stage: 'mvp',
                evidence_type: 'product_url',
                label: 'Live app',
                text_value: null,
                url: 'https://app.gamma.uz',
                file_path: null,
                linked_metric_id: null,
                created_by: null,
                created_at: '2026-09-10T00:00:00Z',
              },
              {
                id: 'e2',
                startup_id: 'startup-1',
                requirement_id: null,
                update_id: 'u9',
                stage: 'mvp',
                evidence_type: 'metric',
                label: 'Active Users',
                text_value: null,
                url: null,
                file_path: null,
                linked_metric_id: 'm1',
                created_by: null,
                created_at: '2026-09-10T00:00:00Z',
              },
            ],
            metrics: [{ id: 'm1', name: 'Active Users', unit: 'number', currency: null } as never],
            entries: [
              {
                metric_id: 'm1',
                value: 100,
                recorded_on: '2026-09-01',
                created_at: '2026-09-01T00:00:00Z',
              },
              {
                metric_id: 'm1',
                value: 150,
                recorded_on: '2026-09-08',
                created_at: '2026-09-08T00:00:00Z',
              },
              // Recorded after the update was published: not part of its movement.
              {
                metric_id: 'm1',
                value: 400,
                recorded_on: '2026-09-20',
                created_at: '2026-09-20T00:00:00Z',
              },
            ] as never,
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Product · Traction')).toBeInTheDocument();
    expect(screen.getByText('MVP')).toBeInTheDocument();
    expect(screen.getByText('Live app')).toBeInTheDocument();
    expect(screen.getByText('Traction movement')).toBeInTheDocument();
    expect(screen.getByText('100 → 150')).toBeInTheDocument();
    expect(screen.getByText('Payment integration')).toBeInTheDocument();
    expect(screen.getByText('Reach 1,000 users')).toBeInTheDocument();
    expect(screen.getByText(/Target: Nov 30, 2026/)).toBeInTheDocument();
  });
});
