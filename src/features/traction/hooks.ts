import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { founderKeys } from '@/features/founder-keys';
import { fetchEntries, fetchMetrics } from './api';

export function useMetrics(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.metrics(startupId ?? ''),
    queryFn: () => fetchMetrics(startupId as string),
    enabled: Boolean(startupId),
  });
}

export function useEntries(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.entries(startupId ?? ''),
    queryFn: () => fetchEntries(startupId as string),
    enabled: Boolean(startupId),
  });
}

/** Refreshes cards, charts and history after traction changes. */
export function useRefreshTraction(startupId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: founderKeys.metrics(startupId) }),
        queryClient.invalidateQueries({ queryKey: founderKeys.entries(startupId) }),
      ]),
    [queryClient, startupId],
  );
}
