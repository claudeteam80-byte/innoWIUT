import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEvidence } from '@/features/journey/hooks';
import { useEntries, useMetrics } from '@/features/traction/hooks';
import { founderKeys } from '@/features/founder-keys';
import { createSignedUrl, SIGNED_URL_TTL_SECONDS } from '@/lib/storage';
import { fetchUpdates } from './api';
import type { UpdateContext } from './components/UpdateCard';

export function useUpdates(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.updates(startupId ?? ''),
    queryFn: () => fetchUpdates(startupId as string),
    enabled: Boolean(startupId),
  });
}

/**
 * Short-lived signed URL for a private update attachment. Re-fetched before it
 * expires, and on demand if the image fails to load.
 */
export function useSignedImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: founderKeys.signedUrl(path ?? ''),
    queryFn: () => createSignedUrl('update-attachments', path as string),
    enabled: Boolean(path),
    staleTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
    gcTime: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
    refetchInterval: (SIGNED_URL_TTL_SECONDS - 5 * 60) * 1000,
  });
}

/**
 * Evidence and traction history for rendering updates' proof. Undefined until loaded, so
 * cards render immediately and the proof appears when ready.
 */
export function useUpdateContext(startupId: string | undefined): UpdateContext | undefined {
  const evidence = useEvidence(startupId);
  const metrics = useMetrics(startupId);
  const entries = useEntries(startupId);
  return useMemo(
    () =>
      evidence.data && metrics.data && entries.data
        ? { evidence: evidence.data, metrics: metrics.data, entries: entries.data }
        : undefined,
    [evidence.data, metrics.data, entries.data],
  );
}
