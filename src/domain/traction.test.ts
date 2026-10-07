import { describe, expect, it } from 'vitest';
import {
  calculateChangePercent,
  describeMetricChange,
  strongestGrowth,
  targetProgress,
} from './traction';

describe('calculateChangePercent', () => {
  it('computes percentage change', () => {
    expect(calculateChangePercent(100, 150)).toBe(50);
    expect(calculateChangePercent(200, 150)).toBe(-25);
    expect(calculateChangePercent(80, 80)).toBe(0);
  });

  it('accepts numeric strings (Postgres numeric)', () => {
    expect(calculateChangePercent('100', '125')).toBe(25);
  });

  it('returns null when a percentage is meaningless', () => {
    expect(calculateChangePercent(0, 50)).toBeNull();
    expect(calculateChangePercent(-10, 50)).toBeNull();
    expect(calculateChangePercent(null, 50)).toBeNull();
    expect(calculateChangePercent(50, undefined)).toBeNull();
    expect(calculateChangePercent('abc', 50)).toBeNull();
  });
});

describe('describeMetricChange', () => {
  it('shows growth as a positive percentage', () => {
    expect(describeMetricChange(100, 150)).toEqual({
      tone: 'positive',
      text: '+50%',
      percent: 50,
      delta: 50,
    });
  });

  it('shows decline as a negative percentage', () => {
    expect(describeMetricChange(200, 150)).toMatchObject({ tone: 'negative', text: '-25%' });
  });

  it('uses one decimal below 10%', () => {
    expect(describeMetricChange(1000, 1045).text).toBe('+4.5%');
    expect(describeMetricChange(1000, 955).text).toBe('-4.5%');
  });

  it('reports no change', () => {
    expect(describeMetricChange(640, 640)).toEqual({
      tone: 'neutral',
      text: 'No change',
      percent: 0,
      delta: 0,
    });
  });

  it('falls back to absolute change when previous value is zero', () => {
    expect(describeMetricChange(0, 1200)).toEqual({
      tone: 'positive',
      text: '+1,200',
      percent: null,
      delta: 1200,
    });
  });

  it('shows a dash when there is no previous or current value', () => {
    expect(describeMetricChange(null, 640).text).toBe('—');
    expect(describeMetricChange(640, null).text).toBe('—');
  });
});

describe('strongestGrowth', () => {
  it('returns the largest positive change across metrics', () => {
    expect(
      strongestGrowth([
        { previous_value: 100, current_value: 110 },
        { previous_value: 50, current_value: 100 },
        { previous_value: 10, current_value: 5 },
      ]),
    ).toBe(100);
  });

  it('returns 0 when nothing grew or there is no history', () => {
    expect(strongestGrowth([])).toBe(0);
    expect(strongestGrowth([{ previous_value: 10, current_value: 5 }])).toBe(0);
    expect(strongestGrowth([{ previous_value: null, current_value: 5 }])).toBe(0);
  });
});

describe('targetProgress', () => {
  it('returns progress clamped to 0–100', () => {
    expect(targetProgress(640, 1000)).toBe(64);
    expect(targetProgress(1500, 1000)).toBe(100);
  });

  it('returns null without a usable target', () => {
    expect(targetProgress(640, null)).toBeNull();
    expect(targetProgress(640, 0)).toBeNull();
  });
});
