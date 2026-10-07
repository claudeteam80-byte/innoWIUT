import type { CurrencyCode, MetricUnit } from '@/types/app';

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ['USD', 'UZS'];

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const uzsFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

// Non-breaking space keeps "1 240 000 UZS" on one line.
const NBSP = '\u00a0';

export function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatNumber(value: number | string | null | undefined): string {
  const number = toFiniteNumber(value);
  return number === null ? '—' : numberFormatter.format(number);
}

export function formatMoney(
  value: number | string | null | undefined,
  currency: CurrencyCode,
): string {
  const number = toFiniteNumber(value);
  if (number === null) return '—';
  if (currency === 'UZS') return `${uzsFormatter.format(number).replaceAll(',', NBSP)}${NBSP}UZS`;
  return usdFormatter.format(number);
}

export function formatMetricValue(
  value: number | string | null | undefined,
  unit: MetricUnit,
  currency?: CurrencyCode | null,
): string {
  const number = toFiniteNumber(value);
  if (number === null) return '—';
  switch (unit) {
    case 'percent':
      return `${numberFormatter.format(number)}%`;
    case 'currency':
      return currency ? formatMoney(number, currency) : numberFormatter.format(number);
    case 'number':
      return numberFormatter.format(number);
  }
}

export function formatSignedNumber(value: number): string {
  const formatted = numberFormatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatSignedPercent(value: number): string {
  const magnitude = Math.abs(value);
  const digits = magnitude >= 10 ? 0 : 1;
  const text = `${magnitude.toFixed(digits)}%`;
  if (Number(magnitude.toFixed(digits)) === 0) return text;
  return value > 0 ? `+${text}` : `-${text}`;
}

/** Compact axis labels: 1,200 → 1.2K, 3,400,000 → 3.4M. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const compact = (n: number, suffix: string) =>
    `${Number((value / n).toFixed(abs / n >= 10 ? 0 : 1))}${suffix}`;
  if (abs >= 1e9) return compact(1e9, 'B');
  if (abs >= 1e6) return compact(1e6, 'M');
  if (abs >= 1e3) return compact(1e3, 'K');
  return numberFormatter.format(value);
}
