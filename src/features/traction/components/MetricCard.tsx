import { formatRelativeDay } from '@/domain/dates';
import { formatMetricValue } from '@/domain/format';
import { describeMetricChange, targetProgress } from '@/domain/traction';
import type { Metric } from '../api';
import { ChangePill } from './ChangePill';

export function MetricCard({ metric }: { metric: Metric }) {
  const change = describeMetricChange(metric.previous_value, metric.current_value);
  const progress = targetProgress(metric.current_value, metric.target);
  return (
    <article className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-card">
      <h3 className="truncate text-[12.5px] font-medium text-muted">{metric.name}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-[22px] font-semibold tracking-tight text-ink">
          {formatMetricValue(metric.current_value, metric.unit, metric.currency)}
        </p>
        <ChangePill change={change} />
      </div>
      {metric.target !== null && (
        <div className="mt-3 space-y-1">
          <p className="text-[12px] text-muted">
            Target{' '}
            <span className="font-medium text-ink">
              {formatMetricValue(metric.target, metric.unit, metric.currency)}
            </span>
          </p>
          {progress !== null && (
            <div className="h-1 overflow-hidden rounded-full bg-primary-soft" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
      <p className="mt-auto pt-3 text-[11.5px] text-subtle">
        {metric.last_recorded_on
          ? `Updated ${formatRelativeDay(metric.last_recorded_on).toLowerCase()}`
          : 'No values yet'}
      </p>
    </article>
  );
}
