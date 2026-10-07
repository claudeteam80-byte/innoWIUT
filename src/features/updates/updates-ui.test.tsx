import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import type { StartupUpdate } from './api';
import { UpdatesPage } from './pages/UpdatesPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const state = vi.hoisted(() => ({ updates: [] as unknown[] }));
const api = vi.hoisted(() => ({
  publishDraft: vi.fn(),
  deleteDraft: vi.fn(),
  createUpdate: vi.fn(),
  editUpdate: vi.fn(),
  fetchUpdates: vi.fn(),
}));
vi.mock('@/features/startup/hooks', () => ({
  useMyStartup: () => ({
    data: { id: 'startup-1' },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('./hooks', () => ({
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
  state.updates = [];
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

  it('opens the editor instead of publishing a draft without "What happened?"', async () => {
    const user = userEvent.setup();
    state.updates = [update({ id: 'd1', summary: null })];
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

describe('UpdateDialog', () => {
  it('saves a draft with only a title and publishes with "What happened?"', async () => {
    const user = userEvent.setup();
    api.createUpdate.mockImplementation(async (_startupId: string, row: { status: string }) => ({
      ...update({}),
      ...row,
    }));
    renderPage();
    await user.click(screen.getAllByRole('button', { name: /Create Update/ })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'New update' });
    await user.click(within(dialog).getByRole('button', { name: 'Save Draft' }));
    await vi.waitFor(() => expect(api.createUpdate).toHaveBeenCalledTimes(1));
    expect(api.createUpdate.mock.calls[0]![1]).toMatchObject({
      status: 'draft',
      summary: null,
      image_path: null,
    });

    await user.click(screen.getAllByRole('button', { name: /Create Update/ })[0]!);
    const second = await screen.findByRole('dialog', { name: 'New update' });
    await user.click(within(second).getByRole('button', { name: 'Publish Update' }));
    expect(
      await within(second).findByText('Describe what happened before publishing.'),
    ).toBeInTheDocument();
    await user.type(within(second).getByLabelText(/What happened/), 'Shipped V2');
    await user.type(within(second).getByLabelText('Highlight 1'), 'First pilot');
    await user.click(within(second).getByRole('button', { name: 'Publish Update' }));
    await vi.waitFor(() => expect(api.createUpdate).toHaveBeenCalledTimes(2));
    expect(api.createUpdate.mock.calls[1]![1]).toMatchObject({
      status: 'published',
      summary: 'Shipped V2',
      highlights: ['First pilot'],
    });
  });
});
