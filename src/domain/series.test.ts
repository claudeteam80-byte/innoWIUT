import { describe, expect, it } from 'vitest';
import { buildSeries, niceTicks } from './series';

const now = new Date(2026, 9, 8, 12);
const entries = [
  { metric_id: 'm1', value: 100, recorded_on: '2026-03-01', created_at: '2026-03-01T10:00:00Z' },
  { metric_id: 'm1', value: '150', recorded_on: '2026-08-20', created_at: '2026-08-20T10:00:00Z' },
  { metric_id: 'm1', value: 160, recorded_on: '2026-10-01', created_at: '2026-10-01T09:00:00Z' },
  { metric_id: 'm1', value: 170, recorded_on: '2026-10-01', created_at: '2026-10-01T11:00:00Z' },
  { metric_id: 'm2', value: 9, recorded_on: '2026-10-02', created_at: '2026-10-02T10:00:00Z' },
];

describe('buildSeries', () => {
  it('returns one metric oldest-first for all time', () => {
    expect(buildSeries(entries, 'm1', 'all', now).map((p) => p.value)).toEqual([100, 150, 170]);
  });

  it('keeps the latest value recorded on the same day', () => {
    const series = buildSeries(entries, 'm1', 'all', now);
    expect(series.at(-1)).toEqual({ date: new Date(2026, 9, 1), value: 170 });
  });

  it('limits to the last 30 days and 3 months', () => {
    expect(buildSeries(entries, 'm1', '30d', now).map((p) => p.value)).toEqual([170]);
    expect(buildSeries(entries, 'm1', '3m', now).map((p) => p.value)).toEqual([150, 170]);
  });

  it('is empty for a metric without history', () => {
    expect(buildSeries(entries, 'unknown', 'all', now)).toEqual([]);
  });

  it('skips unusable values', () => {
    expect(
      buildSeries(
        [{ metric_id: 'm1', value: 'oops', recorded_on: '2026-10-01' }],
        'm1',
        'all',
        now,
      ),
    ).toEqual([]);
  });
});

describe('niceTicks', () => {
  it('produces round steps covering the data', () => {
    expect(niceTicks(0, 640)).toEqual([0, 200, 400, 600, 800]);
    expect(niceTicks(120, 980)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('handles flat zero data', () => {
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
