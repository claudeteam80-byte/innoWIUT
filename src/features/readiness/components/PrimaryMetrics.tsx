import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { Dialog } from '@/components/ui/Dialog';
import { formatDate } from '@/domain/dates';
import { formatMetricValue } from '@/domain/format';
import { describeMetricChange } from '@/domain/traction';
import { founderKeys } from '@/features/founder-keys';
import type { Entry, Metric } from '@/features/traction/api';
import { ChangePill } from '@/features/traction/components/ChangePill';
import { errorMessage } from '@/lib/errors';
import { savePrimaryMetrics } from '../api';

export const MAX_PRIMARY_METRICS = 5;

/**
 * The founder's chosen traction metrics with live values from traction: current, previous,
 * the calculated change and the recent history. Numbers are never typed or copied here.
 */
export function PrimaryMetricsTable({
  metricIds,
  metrics,
  entries,
}: {
  metricIds: readonly string[];
  metrics: readonly Metric[];
  entries: readonly Entry[];
}) {
  const chosen = metricIds
    .map((id) => metrics.find((m) => m.id === id))
    .filter((m): m is Metric => Boolean(m));
  if (chosen.length === 0) return null;
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {chosen.map((metric) => {
        const fmt = (value: number | null) =>
          formatMetricValue(value, metric.unit, metric.currency);
        const history = entries
          .filter((e) => e.metric_id === metric.id)
          .sort(
            (a, b) =>
              b.recorded_on.localeCompare(a.recorded_on) ||
              b.created_at.localeCompare(a.created_at),
          )
          .slice(0, 5);
        return (
          <li
            key={metric.id}
            className="rounded-lg border border-line bg-canvas-subtle px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-semibold text-ink">{metric.name}</p>
              <ChangePill
                change={describeMetricChange(metric.previous_value, metric.current_value)}
              />
            </div>
            <p className="mt-1 text-[20px] font-semibold text-ink">{fmt(metric.current_value)}</p>
            <p className="text-[12px] text-muted">
              Previous {fmt(metric.previous_value)}
              {metric.last_recorded_on && ` · Updated ${formatDate(metric.last_recorded_on)}`}
            </p>
            {history.length > 1 && (
              <p className="mt-2 text-[11.5px] text-muted">
                History:{' '}
                {history
                  .slice()
                  .reverse()
                  .map((e) => fmt(e.value))
                  .join(' → ')}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  selected: readonly string[];
  metrics: readonly Metric[];
}

export function PrimaryMetricsDialog(props: DialogProps) {
  return props.open ? <PrimaryMetricsForm {...props} /> : null;
}

function PrimaryMetricsForm({ open, onOpenChange, startupId, selected, metrics }: DialogProps) {
  const queryClient = useQueryClient();
  const available = metrics.filter((m) => !m.is_archived);
  const [ids, setIds] = useState<string[]>(() =>
    selected.filter((id) => available.some((m) => m.id === id)),
  );
  const save = useMutation({
    mutationFn: () => savePrimaryMetrics(startupId, selected, ids),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.readiness(startupId) });
      toast.success('Primary investor metrics saved.');
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save your metrics.")),
  });
  const toggle = (id: string, on: boolean) =>
    setIds((current) => (on ? [...current, id] : current.filter((x) => x !== id)));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title="Primary investor metrics"
      description={`Choose up to ${MAX_PRIMARY_METRICS} of your existing traction metrics an investor should see first. Values always come from Traction.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!available.length}
          >
            Save Metrics
          </Button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="text-[13px] text-muted">
          You have no traction metrics yet.{' '}
          <Link to={paths.founder.traction} className="font-medium text-primary hover:underline">
            Add one in Traction
          </Link>{' '}
          first.
        </p>
      ) : (
        <fieldset className="space-y-3">
          <legend className="sr-only">Traction metrics</legend>
          {available.map((metric) => {
            const checked = ids.includes(metric.id);
            return (
              <CheckboxField
                key={metric.id}
                checked={checked}
                disabled={!checked && ids.length >= MAX_PRIMARY_METRICS}
                onChange={(event) => toggle(metric.id, event.target.checked)}
                label={
                  <>
                    <span className="font-medium text-ink">{metric.name}</span> ·{' '}
                    {metric.current_value === null
                      ? 'no value recorded yet'
                      : formatMetricValue(metric.current_value, metric.unit, metric.currency)}
                  </>
                }
              />
            );
          })}
          <p className="text-[12px] text-muted">
            {ids.length} of {MAX_PRIMARY_METRICS} selected. A metric needs a recorded value to
            count.
          </p>
        </fieldset>
      )}
    </Dialog>
  );
}
