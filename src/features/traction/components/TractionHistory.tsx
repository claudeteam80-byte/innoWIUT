import { formatDate } from '@/domain/dates';
import { formatMetricValue } from '@/domain/format';
import { describeMetricChange } from '@/domain/traction';
import type { Entry, Metric } from '../api';
import { historyRows, type HistoryRow as Row } from '../utils';
import { ChangePill } from './ChangePill';

export function TractionHistory({ entries, metrics }: { entries: Entry[]; metrics: Metric[] }) {
  const rows = historyRows(entries, metrics);
  const value = (row: Row, n: number | null) =>
    row.metric ? formatMetricValue(n, row.metric.unit, row.metric.currency) : String(n ?? '—');

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">Traction history, newest first</caption>
          <thead>
            <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              <th scope="col" className="py-2.5 pr-4">
                Date
              </th>
              <th scope="col" className="py-2.5 pr-4">
                Metric
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right">
                Previous
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right">
                Value
              </th>
              <th scope="col" className="py-2.5 pr-4">
                Change
              </th>
              <th scope="col" className="py-2.5">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entry.id} className="border-b border-line/70 last:border-0">
                <td className="whitespace-nowrap py-3 pr-4 text-muted">
                  {formatDate(row.entry.recorded_on)}
                </td>
                <td className="py-3 pr-4 font-medium text-ink">
                  {row.metric?.name ?? 'Archived metric'}
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums text-muted">
                  {value(row, row.previous)}
                </td>
                <td className="whitespace-nowrap py-3 pr-4 text-right font-medium tabular-nums text-ink">
                  {value(row, Number(row.entry.value))}
                </td>
                <td className="py-3 pr-4">
                  <ChangePill change={describeMetricChange(row.previous, row.entry.value)} />
                </td>
                <td className="py-3 text-muted">{row.entry.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.entry.id} className="rounded-lg border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {row.metric?.name ?? 'Archived metric'}
                </p>
                <p className="text-[12px] text-muted">{formatDate(row.entry.recorded_on)}</p>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-semibold text-ink">
                  {value(row, Number(row.entry.value))}
                </p>
                <ChangePill change={describeMetricChange(row.previous, row.entry.value)} />
              </div>
            </div>
            {row.entry.note && <p className="mt-2 text-[12.5px] text-muted">{row.entry.note}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
