import { subDays, subMonths } from 'date-fns';
import { parseDate } from './dates';

export type ChartPeriod = '30d' | '3m' | 'all';

export const CHART_PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: '30d', label: '30 Days' },
  { value: '3m', label: '3 Months' },
  { value: 'all', label: 'All Time' },
];

export interface EntryLike {
  metric_id: string;
  value: number | string;
  recorded_on: string;
  created_at?: string;
}

export interface SeriesPoint {
  date: Date;
  value: number;
}

export function periodStart(period: ChartPeriod, now: Date = new Date()): Date | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === '30d') return subDays(today, 30);
  if (period === '3m') return subMonths(today, 3);
  return null;
}

/**
 * Chart points for one metric: oldest first, one point per day (the last value
 * recorded that day wins), limited to the period.
 */
export function buildSeries(
  entries: readonly EntryLike[],
  metricId: string,
  period: ChartPeriod,
  now: Date = new Date(),
): SeriesPoint[] {
  const start = periodStart(period, now);
  const byDay = new Map<string, { entry: EntryLike; date: Date }>();

  for (const entry of entries) {
    if (entry.metric_id !== metricId) continue;
    const date = parseDate(entry.recorded_on);
    const value = Number(entry.value);
    if (!date || !Number.isFinite(value)) continue;
    if (start && date < start) continue;
    const existing = byDay.get(entry.recorded_on);
    if (!existing || (entry.created_at ?? '') >= (existing.entry.created_at ?? '')) {
      byDay.set(entry.recorded_on, { entry, date });
    }
  }

  return [...byDay.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ entry, date }) => ({ date, value: Number(entry.value) }));
}

/** Clean, evenly spaced y-axis ticks from 0 (or below, for negatives) to above max. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const low = Math.min(0, min);
  const high = max <= low ? low + 1 : max;
  const rough = (high - low) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let tick = Math.floor(low / step) * step; tick < high + step; tick += step) {
    ticks.push(Number(tick.toFixed(10)));
    if (tick >= high) break;
  }
  return ticks;
}
