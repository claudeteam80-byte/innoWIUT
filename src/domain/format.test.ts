import { describe, expect, it } from 'vitest';
import { formatMetricValue, formatMoney, formatNumber, formatSignedPercent } from './format';

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

  it('formats UZS without decimals and with the code', () => {
    expect(formatMoney(12500000, 'UZS')).toBe('12,500,000 UZS');
    expect(formatMoney(999.6, 'UZS')).toBe('1,000 UZS');
  });
});

describe('formatMetricValue', () => {
  it('formats by unit', () => {
    expect(formatMetricValue(640, 'number')).toBe('640');
    expect(formatMetricValue(42.5, 'percent')).toBe('42.5%');
    expect(formatMetricValue(3000, 'currency', 'USD')).toBe('$3,000');
    expect(formatMetricValue(3000000, 'currency', 'UZS')).toBe('3,000,000 UZS');
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
