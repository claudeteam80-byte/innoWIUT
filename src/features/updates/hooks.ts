import { useQuery } from '@tanstack/react-query';
import { founderKeys } from '@/features/founder-keys';
import { createSignedUrl, SIGNED_URL_TTL_SECONDS } from '@/lib/storage';
import { fetchUpdates } from './api';

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
