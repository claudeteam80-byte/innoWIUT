import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { localToday } from '@/domain/form-fields';
import { CURRENCIES, CUSTOM_METRIC, METRIC_PRESETS, METRIC_UNITS } from '@/domain/options';
import { addMetric, tractionErrorMessage } from '../api';
import { useRefreshTraction } from '../hooks';
import { addMetricSchema, type AddMetricInput } from '../schemas';

const presetOptions = [
  ...METRIC_PRESETS.map((preset) => ({ value: preset.name, label: preset.name })),
  { value: CUSTOM_METRIC, label: 'Custom metric' },
];

const defaults = (): AddMetricInput => ({
  preset: '',
  name: '',
  unit: 'number',
  currency: '',
  current_value: '',
  recorded_on: localToday(),
  target: '',
  note: '',
});

export function AddMetricDialog({
  open,
  onOpenChange,
  startupId,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  existingNames: string[];
}) {
  const refresh = useRefreshTraction(startupId);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(addMetricSchema), defaultValues: defaults() });
  const preset = useWatch({ control, name: 'preset' });
  const unit = useWatch({ control, name: 'unit' });

  const mutation = useMutation({
    mutationFn: addMetric,
    onSuccess: async (metric) => {
      await refresh();
      toast.success(`${metric.name} is now tracked.`);
      reset(defaults());
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(tractionErrorMessage(error, "We couldn't add that metric. Please try again.")),
  });

  const onSubmit = handleSubmit((values) => {
    if (existingNames.some((name) => name.toLowerCase() === values.name.toLowerCase())) {
      setError(preset === CUSTOM_METRIC ? 'name' : 'preset', {
        message: 'You already track a metric with that name.',
      });
      return;
    }
    mutation.mutate(values);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset(defaults());
        onOpenChange(next);
      }}
      title="Add metric"
      description="Choose a number that matters to your startup and record its current value."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="add-metric-form" loading={mutation.isPending}>
            Add Metric
          </Button>
        </>
      }
    >
      <form
        id="add-metric-form"
        onSubmit={onSubmit}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <SelectField
          label="Metric"
          required
          placeholder="Select a metric"
          options={presetOptions}
          error={errors.preset?.message}
          className="sm:col-span-2"
          {...register('preset', {
            onChange: (event) => {
              const match = METRIC_PRESETS.find((p) => p.name === event.target.value);
              if (match) setValue('unit', match.unit);
            },
          })}
        />
        {preset === CUSTOM_METRIC && (
          <TextField
            label="Metric name"
            required
            placeholder="e.g. Weekly active learners"
            error={errors.name?.message}
            className="sm:col-span-2"
            {...register('name')}
          />
        )}
        <SelectField
          label="Unit"
          required
          options={METRIC_UNITS}
          error={errors.unit?.message}
          {...register('unit')}
        />
        {unit === 'currency' ? (
          <SelectField
            label="Currency"
            required
            placeholder="Select"
            options={CURRENCIES}
            error={errors.currency?.message}
            {...register('currency')}
          />
        ) : (
          <div className="hidden sm:block" />
        )}
        <TextField
          label="Current value"
          required
          inputMode="decimal"
          error={errors.current_value?.message}
          {...register('current_value')}
        />
        <TextField
          label="As of"
          type="date"
          required
          max={localToday()}
          error={errors.recorded_on?.message}
          {...register('recorded_on')}
        />
        <TextField
          label="Target"
          hint="Optional"
          inputMode="decimal"
          error={errors.target?.message}
          {...register('target')}
        />
        <TextareaField
          label="Note"
          hint="Optional — why this metric matters right now."
          rows={2}
          className="sm:col-span-2"
          error={errors.note?.message}
          {...register('note')}
        />
      </form>
    </Dialog>
  );
}
