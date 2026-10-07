import { describe, expect, it } from 'vitest';
import { localToday } from '@/domain/form-fields';
import { CUSTOM_METRIC } from '@/domain/options';
import { issues } from '@/test/zod';
import { addMetricSchema, recordTractionSchema } from './schemas';

const today = localToday();
const base = {
  preset: 'MRR',
  name: '',
  unit: 'currency' as const,
  currency: 'USD' as const,
  current_value: '1240',
  recorded_on: today,
  target: '',
  note: '',
};

describe('addMetricSchema', () => {
  it('uses the preset name and keeps the currency', () => {
    expect(addMetricSchema.parse(base)).toEqual({
      name: 'MRR',
      unit: 'currency',
      currency: 'USD',
      current_value: 1240,
      recorded_on: today,
      target: null,
      note: null,
    });
  });

  it('requires a name for custom metrics and a currency for money', () => {
    const result = addMetricSchema.safeParse({ ...base, preset: CUSTOM_METRIC, currency: '' });
    expect(issues(result)).toEqual({
      name: 'Give your metric a name.',
      currency: 'Choose a currency.',
    });
  });

  it('drops the currency for non-money units', () => {
    expect(
      addMetricSchema.parse({ ...base, preset: 'Customers', unit: 'number' }).currency,
    ).toBeNull();
  });

  it('caps percentages at 100 and rejects future dates', () => {
    const result = addMetricSchema.safeParse({
      ...base,
      preset: 'Retention',
      unit: 'percent',
      current_value: '120',
      recorded_on: '2999-01-01',
    });
    expect(issues(result)).toMatchObject({
      current_value: 'A percentage cannot be above 100.',
      recorded_on: 'The date cannot be in the future.',
    });
  });
});

describe('recordTractionSchema', () => {
  const metrics = [
    { id: 'm1', unit: 'number' },
    { id: 'm2', unit: 'percent' },
  ];

  it('collects only the metrics that got a new value', () => {
    expect(
      recordTractionSchema(metrics).parse({
        values: { m1: '700', m2: '' },
        recorded_on: today,
        note: '',
      }),
    ).toEqual({ entries: [{ metric_id: 'm1', value: 700 }], recorded_on: today, note: null });
  });

  it('needs at least one value', () => {
    expect(
      issues(recordTractionSchema(metrics).safeParse({ values: {}, recorded_on: today, note: '' })),
    ).toEqual({
      values: 'Enter a new value for at least one metric.',
    });
  });

  it('validates each value', () => {
    const result = recordTractionSchema(metrics).safeParse({
      values: { m1: '-1', m2: '101' },
      recorded_on: today,
      note: '',
    });
    expect(issues(result)).toEqual({
      'values.m1': 'Use zero or more.',
      'values.m2': 'A percentage cannot be above 100.',
    });
  });
});
