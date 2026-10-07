import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedInAs, TestProviders } from '@/test/auth-test-utils';
import type { Metric } from './api';
import { MetricCard } from './components/MetricCard';
import { TractionPage } from './pages/TractionPage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const state = vi.hoisted(() => ({ metrics: [] as unknown[], entries: [] as unknown[] }));
vi.mock('@/features/startup/hooks', () => ({
  useMyStartup: () => ({
    data: { id: 'startup-1' },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('./hooks', () => ({
  useMetrics: () => ({ data: state.metrics, isPending: false, isError: false, refetch: vi.fn() }),
  useEntries: () => ({ data: state.entries, isPending: false, isError: false, refetch: vi.fn() }),
  useRefreshTraction: () => vi.fn(),
}));

const metric = (overrides: Partial<Metric>): Metric => ({
  id: 'm1',
  startup_id: 'startup-1',
  name: 'Monthly Revenue',
  unit: 'currency',
  currency: 'UZS',
  target: null,
  note: null,
  is_archived: false,
  current_value: 1240000,
  previous_value: 1000000,
  last_recorded_on: '2026-10-01',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...overrides,
});

function renderPage() {
  render(
    <TestProviders auth={signedInAs('founder')}>
      <MemoryRouter>
        <TractionPage />
      </MemoryRouter>
    </TestProviders>,
  );
}

beforeEach(() => {
  state.metrics = [];
  state.entries = [];
});

describe('TractionPage', () => {
  it('shows the empty state with an Add Metric call to action when nothing is tracked', () => {
    renderPage();
    expect(screen.getByText('No traction yet')).toBeInTheDocument();
    expect(
      screen.getByText('Track the numbers that matter to your startup.', {
        selector: 'p.max-w-md',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add Metric/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Update Metrics/ })).toBeDisabled();
  });

  it('shows real metric cards, chart and history when metrics exist', () => {
    state.metrics = [metric({})];
    state.entries = [
      {
        id: 'e1',
        metric_id: 'm1',
        startup_id: 'startup-1',
        value: 1000000,
        recorded_on: '2026-09-01',
        note: null,
        created_by: null,
        created_at: '2026-09-01T00:00:00Z',
      },
      {
        id: 'e2',
        metric_id: 'm1',
        startup_id: 'startup-1',
        value: 1240000,
        recorded_on: '2026-10-01',
        note: 'Launch',
        created_by: null,
        created_at: '2026-10-01T00:00:00Z',
      },
    ];
    renderPage();
    expect(screen.queryByText('No traction yet')).not.toBeInTheDocument();
    expect(screen.getAllByText('1 240 000 UZS').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: /Monthly Revenue: 2 values/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Traction history/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Metrics/ })).toBeEnabled();
  });
});

describe('MetricCard', () => {
  it('handles a zero previous value without NaN or Infinity', () => {
    render(
      <MetricCard
        metric={metric({ unit: 'number', currency: null, previous_value: 0, current_value: 1200 })}
      />,
    );
    const card = screen.getByRole('article');
    expect(within(card).getByText('1,200')).toBeInTheDocument();
    expect(within(card).getByText('+1,200')).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('shows the target and percentage change', () => {
    render(
      <MetricCard
        metric={metric({
          unit: 'currency',
          currency: 'USD',
          previous_value: 1000,
          current_value: 1240,
          target: 2000,
        })}
      />,
    );
    expect(screen.getByText('$1,240')).toBeInTheDocument();
    expect(screen.getByText('+24%')).toBeInTheDocument();
    expect(screen.getByText('$2,000')).toBeInTheDocument();
  });

  it('shows a dash-free card for a brand new metric', () => {
    render(
      <MetricCard
        metric={metric({
          unit: 'percent',
          currency: null,
          previous_value: null,
          current_value: 28,
        })}
      />,
    );
    expect(screen.getByText('28%')).toBeInTheDocument();
    expect(screen.queryByLabelText(/since the previous value/)).not.toBeInTheDocument();
  });
});
