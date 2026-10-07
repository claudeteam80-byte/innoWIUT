import type { Entry, Metric } from './api';

export interface HistoryRow {
  entry: Entry;
  metric: Metric | undefined;
  previous: number | null;
}

/** Newest first; each row compares with the same metric's previous recorded value. */
export function historyRows(entries: readonly Entry[], metrics: readonly Metric[]): HistoryRow[] {
  const byMetric = new Map(metrics.map((m) => [m.id, m]));
  const ascending = [...entries].sort(
    (a, b) =>
      a.recorded_on.localeCompare(b.recorded_on) || a.created_at.localeCompare(b.created_at),
  );
  const lastValue = new Map<string, number>();
  const rows = ascending.map((entry) => {
    const row = {
      entry,
      metric: byMetric.get(entry.metric_id),
      previous: lastValue.get(entry.metric_id) ?? null,
    };
    lastValue.set(entry.metric_id, Number(entry.value));
    return row;
  });
  return rows.reverse();
}

/** Most recently updated metrics first. */
export function sortByRecent(metrics: readonly Metric[]): Metric[] {
  return [...metrics].sort((a, b) =>
    (b.last_recorded_on ?? '').localeCompare(a.last_recorded_on ?? ''),
  );
}
