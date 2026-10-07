import { z } from 'zod';
import { amount, optionalAmount, optionalText, pastOrTodayDate } from '@/domain/form-fields';
import { CURRENCIES, CUSTOM_METRIC } from '@/domain/options';

export const addMetricSchema = z
  .object({
    preset: z.string().min(1, 'Choose a metric.'),
    name: z.string().trim().max(80, 'Use 80 characters or fewer.'),
    unit: z.enum(['number', 'currency', 'percent'], { error: 'Choose a unit.' }),
    currency: z.union([z.enum(CURRENCIES), z.literal('')]),
    current_value: amount('Enter the current value.'),
    recorded_on: pastOrTodayDate(),
    target: optionalAmount(),
    note: optionalText(500),
  })
  .superRefine((values, ctx) => {
    if (values.preset === CUSTOM_METRIC && !values.name) {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Give your metric a name.' });
    }
    if (values.unit === 'currency' && !values.currency) {
      ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Choose a currency.' });
    }
    if (values.unit === 'percent' && values.current_value > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_value'],
        message: 'A percentage cannot be above 100.',
      });
    }
    if (values.unit === 'percent' && values.target !== null && values.target > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'A percentage cannot be above 100.',
      });
    }
  })
  .transform((values) => ({
    name: values.preset === CUSTOM_METRIC ? values.name : values.preset,
    unit: values.unit,
    currency: values.unit === 'currency' ? values.currency || null : null,
    current_value: values.current_value,
    recorded_on: values.recorded_on,
    target: values.target,
    note: values.note,
  }));

export type AddMetricInput = z.input<typeof addMetricSchema>;
export type AddMetricOutput = z.output<typeof addMetricSchema>;

/** Values for "Update Metrics": one optional new value per metric. */
export function recordTractionSchema(metrics: readonly { id: string; unit: string }[]) {
  return z
    .object({
      values: z.record(z.string(), z.string()),
      recorded_on: pastOrTodayDate(),
      note: optionalText(500),
    })
    .superRefine((input, ctx) => {
      let filled = 0;
      for (const metric of metrics) {
        const raw = (input.values[metric.id] ?? '').trim();
        if (!raw) continue;
        filled += 1;
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          ctx.addIssue({ code: 'custom', path: ['values', metric.id], message: 'Enter a number.' });
        } else if (value < 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['values', metric.id],
            message: 'Use zero or more.',
          });
        } else if (metric.unit === 'percent' && value > 100) {
          ctx.addIssue({
            code: 'custom',
            path: ['values', metric.id],
            message: 'A percentage cannot be above 100.',
          });
        }
      }
      if (filled === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['values'],
          message: 'Enter a new value for at least one metric.',
        });
      }
    })
    .transform((input) => ({
      entries: metrics
        .filter((metric) => (input.values[metric.id] ?? '').trim() !== '')
        .map((metric) => ({ metric_id: metric.id, value: Number(input.values[metric.id]) })),
      recorded_on: input.recorded_on,
      note: input.note,
    }));
}

export type RecordTractionInput = z.input<ReturnType<typeof recordTractionSchema>>;
