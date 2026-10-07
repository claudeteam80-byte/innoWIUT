import { formatSignedNumber, formatSignedPercent } from './format';

type MaybeNumber = number | string | null | undefined;

function toNumber(value: MaybeNumber): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Percentage change from previous to current. Returns null when it cannot be
 * expressed as a percentage (missing values, or a previous value of zero or less).
 */
export function calculateChangePercent(previous: MaybeNumber, current: MaybeNumber): number | null {
  const prev = toNumber(previous);
  const curr = toNumber(current);
  if (prev === null || curr === null || prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

export type ChangeTone = 'positive' | 'negative' | 'neutral';

export interface MetricChange {
  tone: ChangeTone;
  text: string;
  percent: number | null;
  delta: number | null;
}

const NO_DATA: MetricChange = { tone: 'neutral', text: '—', percent: null, delta: null };

/** Describes how a metric moved between its previous and current recorded values. */
export function describeMetricChange(previous: MaybeNumber, current: MaybeNumber): MetricChange {
  const prev = toNumber(previous);
  const curr = toNumber(current);
  if (prev === null || curr === null) return NO_DATA;

  const delta = curr - prev;
  if (delta === 0) return { tone: 'neutral', text: 'No change', percent: 0, delta: 0 };

  const tone: ChangeTone = delta > 0 ? 'positive' : 'negative';
  const percent = calculateChangePercent(prev, curr);
  if (percent === null) {
    return { tone, text: formatSignedNumber(delta), percent: null, delta };
  }
  return { tone, text: formatSignedPercent(percent), percent, delta };
}

/** Highest positive percentage growth across metrics, or 0 when nothing grew. */
export function strongestGrowth(
  metrics: ReadonlyArray<{ previous_value: MaybeNumber; current_value: MaybeNumber }>,
): number {
  return metrics.reduce((best, metric) => {
    const percent = calculateChangePercent(metric.previous_value, metric.current_value);
    return percent !== null && percent > best ? percent : best;
  }, 0);
}

/** Progress towards a target as 0–100, or null when there is no usable target. */
export function targetProgress(current: MaybeNumber, target: MaybeNumber): number | null {
  const curr = toNumber(current);
  const goal = toNumber(target);
  if (curr === null || goal === null || goal <= 0) return null;
  return Math.min(100, Math.max(0, (curr / goal) * 100));
}
