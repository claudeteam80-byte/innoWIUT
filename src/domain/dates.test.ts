import { describe, expect, it } from 'vitest';
import { formatDate, formatRelativeDay, parseDate } from './dates';

const now = new Date(2026, 9, 8, 9);

describe('formatRelativeDay', () => {
  it.each([
    ['2026-10-08', 'Today'],
    ['2026-10-07', 'Yesterday'],
    ['2026-10-04', '4 days ago'],
    ['2026-09-20', 'Sep 20, 2026'],
    [null, '—'],
  ])('%s → %s', (value, expected) => {
    expect(formatRelativeDay(value, now)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('formats short and long dates', () => {
    expect(formatDate('2026-10-08')).toBe('Oct 8, 2026');
    expect(formatDate('2026-10-08', 'long')).toBe('October 8, 2026');
    expect(formatDate('garbage')).toBe('—');
  });

  it('parses date-only values as local dates', () => {
    expect(parseDate('2026-10-08')?.getDate()).toBe(8);
  });
});
