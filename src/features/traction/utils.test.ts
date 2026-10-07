import { describe, expect, it } from 'vitest';
import type { Metric } from './api';
import { sortByRecent } from './utils';

const metric = (name: string, last: string | null, updated: string) =>
  ({ id: name, name, last_recorded_on: last, updated_at: updated }) as Metric;

describe('sortByRecent', () => {
  it('puts the most recently recorded first and breaks same-day ties by last update', () => {
    const sorted = sortByRecent([
      metric('Revenue', '2026-10-07', '2026-10-07T09:00:00Z'),
      metric('Users', '2026-10-07', '2026-10-07T12:00:00Z'),
      metric('Old', '2026-09-01', '2026-10-08T00:00:00Z'),
      metric('Never', null, '2026-10-08T00:00:00Z'),
    ]);
    expect(sorted.map((m) => m.name)).toEqual(['Users', 'Revenue', 'Old', 'Never']);
  });
});
