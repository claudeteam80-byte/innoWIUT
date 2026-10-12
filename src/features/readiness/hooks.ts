import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminKeys } from '@/features/admin/keys';
import { founderKeys } from '@/features/founder-keys';
import { useTeam } from '@/features/startup/hooks';
import { useEntries } from '@/features/traction/hooks';
import {
  fetchAdminInterview,
  fetchInterview,
  fetchReadinessMetrics,
  fetchReadinessProfile,
  fetchReadinessRequirements,
  fetchReadinessState,
  fetchReadinessStats,
} from './api';

const enabled = (startupId: string | undefined, on = true) => Boolean(startupId) && on;

export const useReadinessState = (startupId: string | undefined, on = true) =>
  useQuery({
    queryKey: founderKeys.readinessState(startupId ?? ''),
    queryFn: () => fetchReadinessState(startupId as string),
    enabled: enabled(startupId, on),
  });

export const useReadinessRequirements = (startupId: string | undefined, on = true) =>
  useQuery({
    queryKey: founderKeys.readinessRequirements(startupId ?? ''),
    queryFn: () => fetchReadinessRequirements(startupId as string),
    enabled: enabled(startupId, on),
  });

export const useReadinessProfile = (startupId: string | undefined, on = true) =>
  useQuery({
    queryKey: founderKeys.readinessProfile(startupId ?? ''),
    queryFn: () => fetchReadinessProfile(startupId as string),
    enabled: enabled(startupId, on),
  });

export const useReadinessMetrics = (startupId: string | undefined, on = true) =>
  useQuery({
    queryKey: founderKeys.readinessMetrics(startupId ?? ''),
    queryFn: () => fetchReadinessMetrics(startupId as string),
    enabled: enabled(startupId, on),
  });

export const useInterview = (startupId: string | undefined, on = true) =>
  useQuery({
    queryKey: founderKeys.readinessInterview(startupId ?? ''),
    queryFn: () => fetchInterview(startupId as string),
    enabled: enabled(startupId, on),
  });

export const useAdminInterview = (startupId: string | undefined, on = true) =>
  useQuery({
    queryKey: adminKeys.interview(startupId ?? ''),
    queryFn: () => fetchAdminInterview(startupId as string),
    enabled: enabled(startupId, on),
  });

export const useReadinessStats = () =>
  useQuery({ queryKey: adminKeys.readinessStats, queryFn: fetchReadinessStats });

/** Every readiness query of a startup (state, requirements, profile, metrics, interview). */
export function useRefreshReadiness(startupId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: founderKeys.readiness(startupId) }),
    [queryClient, startupId],
  );
}

/**
 * Everything the readiness screens read, as one result. `data` is set once every query has
 * loaded; `failed` is the first query that errored (for a retry button).
 */
export function useReadinessData(startupId: string | undefined, on = true) {
  const state = useReadinessState(startupId, on);
  const requirements = useReadinessRequirements(startupId, on);
  const profile = useReadinessProfile(startupId, on);
  const metricIds = useReadinessMetrics(startupId, on);
  const interview = useInterview(startupId, on);
  const team = useTeam(on ? startupId : undefined);
  const entries = useEntries(on ? startupId : undefined);
  const queries = [state, requirements, profile, metricIds, interview, team, entries];
  const failed = queries.find((q) => q.isError) ?? null;
  const data =
    state.data &&
    requirements.data &&
    profile.data !== undefined &&
    metricIds.data &&
    interview.data !== undefined &&
    team.data &&
    entries.data
      ? {
          rows: state.data,
          requirements: requirements.data,
          profile: profile.data,
          primaryMetricIds: metricIds.data,
          interview: interview.data,
          team: team.data,
          entries: entries.data,
        }
      : null;
  return { data, failed };
}
export type ReadinessData = NonNullable<ReturnType<typeof useReadinessData>['data']>;
