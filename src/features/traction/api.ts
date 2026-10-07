import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import type { AddMetricOutput } from './schemas';

export type Metric = Tables<'traction_metrics'>;
export type Entry = Tables<'traction_entries'>;

export async function fetchMetrics(startupId: string): Promise<Metric[]> {
  const { data, error } = await supabase
    .from('traction_metrics')
    .select('*')
    .eq('startup_id', startupId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchEntries(startupId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('traction_entries')
    .select('*')
    .eq('startup_id', startupId)
    .order('recorded_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data;
}

/** Metric + first entry in one server transaction (public.add_traction_metric). */
export async function addMetric(values: AddMetricOutput): Promise<Metric> {
  const { data, error } = await supabase.rpc('add_traction_metric', {
    p_name: values.name,
    p_unit: values.unit,
    p_currency: values.currency ?? undefined,
    p_target: values.target ?? undefined,
    p_note: values.note ?? undefined,
    p_initial_value: values.current_value,
    p_recorded_on: values.recorded_on,
  });
  if (error) throw error;
  return data;
}

/** Several values in one server transaction (public.record_traction). */
export async function recordTraction(input: {
  entries: { metric_id: string; value: number }[];
  recorded_on: string;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('record_traction', {
    p_entries: input.entries,
    p_recorded_on: input.recorded_on,
    p_note: input.note ?? undefined,
  });
  if (error) throw error;
}

/** Friendly messages for traction errors from Postgres. */
export function tractionErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return 'You already track a metric with that name.';
  const message = (error as { message?: string } | null)?.message;
  if (code === '22023' && message) return message;
  return fallback;
}
