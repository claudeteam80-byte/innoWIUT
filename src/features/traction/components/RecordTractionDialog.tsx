import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { formatMetricValue } from '@/domain/format';
import { localToday } from '@/domain/form-fields';
import { recordTraction, tractionErrorMessage, type Metric } from '../api';
import { useRefreshTraction } from '../hooks';
import { recordTractionSchema, type RecordTractionInput } from '../schemas';

export function RecordTractionDialog({
  open,
  onOpenChange,
  startupId,
  metrics,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  metrics: Metric[];
}) {
  const refresh = useRefreshTraction(startupId);
  const schema = useMemo(() => recordTractionSchema(metrics), [metrics]);
  const defaults = (): RecordTractionInput => ({ values: {}, recorded_on: localToday(), note: '' });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: defaults() });

  const mutation = useMutation({
    mutationFn: recordTraction,
    onSuccess: async (_, input) => {
      await refresh();
      toast.success(
        `${input.entries.length} metric${input.entries.length === 1 ? '' : 's'} recorded.`,
      );
      reset(defaults());
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(tractionErrorMessage(error, "We couldn't save your numbers. Please try again.")),
  });

  const valueErrors = errors.values as
    (Record<string, { message?: string }> & { message?: string }) | undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset(defaults());
        onOpenChange(next);
      }}
      size="lg"
      title="Update traction"
      description="Record the latest numbers. Every change is kept in your history."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="record-traction-form" loading={mutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="record-traction-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="space-y-5"
      >
        {valueErrors?.message && <Alert tone="error">{valueErrors.message}</Alert>}
        <ul className="space-y-3">
          {metrics.map((metric) => (
            <li
              key={metric.id}
              className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_200px] sm:items-center"
            >
              <div>
                <p className="text-[13.5px] font-medium text-ink">{metric.name}</p>
                <p className="text-[12px] text-muted">
                  Current: {formatMetricValue(metric.current_value, metric.unit, metric.currency)}
                </p>
              </div>
              <TextField
                label={`New value for ${metric.name}`}
                className="[&_label]:sr-only"
                inputMode="decimal"
                placeholder="New value"
                error={valueErrors?.[metric.id]?.message}
                {...register(`values.${metric.id}`)}
              />
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Date"
            type="date"
            required
            max={localToday()}
            error={errors.recorded_on?.message}
            {...register('recorded_on')}
          />
        </div>
        <TextareaField
          label="Note"
          hint="Optional — what drove the change?"
          rows={2}
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Dialog>
  );
}
