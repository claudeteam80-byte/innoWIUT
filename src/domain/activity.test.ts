import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_THRESHOLDS,
  activityFromDays,
  daysSince,
  getActivityStatus,
  latestActivityDate,
} from './activity';

const now = new Date(2026, 9, 20, 15, 30); // 20 Oct 2026, 15:30 local

describe('activity thresholds', () => {
  it('uses 7 / 14 day boundaries', () => {
    expect(ACTIVITY_THRESHOLDS).toEqual({ activeMaxDays: 7, needsUpdateMaxDays: 14 });
  });

  it.each([
    [0, 'active'],
    [7, 'active'],
    [8, 'needs_update'],
    [14, 'needs_update'],
    [15, 'inactive'],
    [120, 'inactive'],
  ] as const)('%i days → %s', (days, key) => {
    expect(activityFromDays(days).key).toBe(key);
    expect(activityFromDays(days).days).toBe(days);
  });

  it('treats no activity as inactive', () => {
    expect(activityFromDays(null)).toEqual({
      key: 'inactive',
      label: 'Inactive',
      tone: 'danger',
      days: null,
    });
  });

  it('labels and tones each bucket', () => {
    expect(activityFromDays(1)).toMatchObject({ label: 'Active', tone: 'positive' });
    expect(activityFromDays(10)).toMatchObject({ label: 'Needs Update', tone: 'warning' });
    expect(activityFromDays(30)).toMatchObject({ label: 'Inactive', tone: 'danger' });
  });
});

describe('daysSince', () => {
  it('counts calendar days for date-only values', () => {
    expect(daysSince('2026-10-20', now)).toBe(0);
    expect(daysSince('2026-10-13', now)).toBe(7);
    expect(daysSince('2026-10-12', now)).toBe(8);
    expect(daysSince('2026-10-05', now)).toBe(15);
  });

  it('counts a late-evening timestamp yesterday as one day', () => {
    expect(daysSince(new Date(2026, 9, 19, 23, 59), now)).toBe(1);
  });

  it('clamps future dates to zero', () => {
    expect(daysSince('2026-10-25', now)).toBe(0);
  });

  it('returns null for missing or invalid dates', () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince('', now)).toBeNull();
    expect(daysSince('not a date', now)).toBeNull();
    expect(daysSince('2026-02-31', now)).toBeNull();
  });
});

describe('getActivityStatus', () => {
  it('maps the last activity date to a bucket', () => {
    expect(getActivityStatus('2026-10-13', now).key).toBe('active');
    expect(getActivityStatus('2026-10-12', now).key).toBe('needs_update');
    expect(getActivityStatus('2026-10-06', now).key).toBe('needs_update');
    expect(getActivityStatus('2026-10-05', now).key).toBe('inactive');
    expect(getActivityStatus(undefined, now).key).toBe('inactive');
  });
});

describe('latestActivityDate', () => {
  it('picks the most recent valid date', () => {
    const latest = latestActivityDate('2026-10-01', null, '2026-10-15', 'garbage', '2026-09-30');
    expect(latest).toEqual(new Date(2026, 9, 15));
  });

  it('returns null when there is nothing to compare', () => {
    expect(latestActivityDate(null, undefined, '')).toBeNull();
  });
});
