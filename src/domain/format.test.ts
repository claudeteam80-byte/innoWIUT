import { describe, expect, it } from 'vitest';
import {
  formatCompact,
  formatMetricValue,
  formatMoney,
  formatNumber,
  formatSignedPercent,
} from './format';

const NBSP = '\u00a0';

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber('1234.5')).toBe('1,234.5');
  });

  it('shows a dash for empty values', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber('')).toBe('—');
    expect(formatNumber('n/a')).toBe('—');
  });
});

describe('formatMoney', () => {
  it('formats USD with a dollar sign', () => {
    expect(formatMoney(2500, 'USD')).toBe('$2,500');
    expect(formatMoney(19.99, 'USD')).toBe('$19.99');
  });

  it('formats UZS with space grouping, no decimals and the code', () => {
    expect(formatMoney(1240000, 'UZS')).toBe(`1${NBSP}240${NBSP}000${NBSP}UZS`);
    expect(formatMoney(999.6, 'UZS')).toBe(`1${NBSP}000${NBSP}UZS`);
    expect(formatMoney(0, 'UZS')).toBe(`0${NBSP}UZS`);
  });

  it('formats the spec examples', () => {
    expect(formatMoney(1240, 'USD')).toBe('$1,240');
    expect(formatMetricValue(28, 'percent')).toBe('28%');
    expect(formatMetricValue(640, 'number')).toBe('640');
  });
});

describe('formatMetricValue', () => {
  it('formats by unit', () => {
    expect(formatMetricValue(640, 'number')).toBe('640');
    expect(formatMetricValue(42.5, 'percent')).toBe('42.5%');
    expect(formatMetricValue(3000, 'currency', 'USD')).toBe('$3,000');
    expect(formatMetricValue(3000000, 'currency', 'UZS')).toBe(`3${NBSP}000${NBSP}000${NBSP}UZS`);
  });

  it('falls back to a plain number when a currency metric has no currency', () => {
    expect(formatMetricValue(3000, 'currency', null)).toBe('3,000');
  });

  it('shows a dash when there is no value yet', () => {
    expect(formatMetricValue(null, 'currency', 'USD')).toBe('—');
  });
});

describe('formatSignedPercent', () => {
  it('signs and rounds', () => {
    expect(formatSignedPercent(12.4)).toBe('+12%');
    expect(formatSignedPercent(-3.25)).toBe('-3.3%');
    expect(formatSignedPercent(0.01)).toBe('0.0%');
  });
});

describe('never shows NaN or Infinity', () => {
  it.each([NaN, Infinity, -Infinity, 'abc', undefined])('%s → dash', (value) => {
    expect(formatMetricValue(value as number, 'number')).toBe('—');
    expect(formatMetricValue(value as number, 'currency', 'USD')).toBe('—');
    expect(formatMetricValue(value as number, 'percent')).toBe('—');
  });
});

describe('formatCompact', () => {
  it('abbreviates large axis values', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(1200)).toBe('1.2K');
    expect(formatCompact(25000)).toBe('25K');
    expect(formatCompact(3400000)).toBe('3.4M');
  });
});
