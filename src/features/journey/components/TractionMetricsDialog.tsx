import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { suggestedMetric, TRACTION_OPTIONS, type StageRequirement } from '@/domain/journey';
import { founderKeys } from '@/features/founder-keys';
import type { Metric } from '@/features/traction/api';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { saveTractionChoices } from '../api';

interface TractionMetricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  requirements: readonly StageRequirement[];
  metrics: readonly Metric[];
}

export function TractionMetricsDialog(props: TractionMetricsDialogProps) {
  return props.open ? <TractionMetricsForm {...props} /> : null;
}

/** The founder picks the numbers that prove market signal. Revenue is not required. */
function TractionMetricsForm({
  open,
  onOpenChange,
  startupId,
  requirements,
  metrics,
}: TractionMetricsDialogProps) {
  const queryClient = useQueryClient();
  const existing = requirements.filter((r) => r.stage === 'traction');
  const [selected, setSelected] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(existing.map((r) => [r.requirement_key, r.linked_metric_id])),
  );

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = { ...current };
      if (key in next) delete next[key];
      else next[key] = suggestedMetric(key, metrics)?.id ?? null;
      return next;
    });

  const save = useMutation({
    mutationFn: () =>
      saveTractionChoices(
        startupId,
        existing,
        TRACTION_OPTIONS.filter((o) => o.key in selected).map((o) => ({
          key: o.key,
          title: o.title,
          metricId: selected[o.key] ?? null,
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.requirements(startupId) });
      const count = Object.keys(selected).length;
      toast.success(
        `Traction proof updated — ${count} ${count === 1 ? 'metric' : 'metrics'} selected.`,
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save your traction metrics.")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      size="lg"
      title="Choose your traction metrics"
      description="Pick the numbers that prove market signal for your business. Revenue is not required."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save Metrics
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ul className="grid gap-2 sm:grid-cols-2">
          {TRACTION_OPTIONS.map((option) => {
            const checked = option.key in selected;
            return (
              <li key={option.key}>
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2.5',
                    checked ? 'border-primary/50 bg-primary-soft/40' : 'border-line bg-white',
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] font-medium text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={checked}
                      onChange={() => toggle(option.key)}
                    />
                    {option.title}
                  </label>
                  {checked && (
                    <select
                      aria-label={`Traction metric for ${option.title}`}
                      className="mt-2 h-9 w-full rounded-md border border-line bg-white px-2 text-[12.5px] text-ink"
                      value={selected[option.key] ?? ''}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [option.key]: event.target.value || null,
                        }))
                      }
                    >
                      <option value="">Not linked yet</option>
                      {metrics.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] text-muted">
          Values always come from your traction history.{' '}
          {metrics.length === 0 ? 'You have no traction metrics yet — ' : 'Missing one? '}
          <Link to={paths.founder.traction} className="font-medium text-primary hover:underline">
            Add it on the Traction page
          </Link>
          .
        </p>
      </div>
    </Dialog>
  );
}
