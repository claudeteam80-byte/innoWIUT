import { useQuery } from '@tanstack/react-query';
import { founderKeys } from '@/features/founder-keys';
import { fetchEvidence, fetchRequirements } from './api';

export function useRequirements(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.requirements(startupId ?? ''),
    queryFn: () => fetchRequirements(startupId as string),
    enabled: Boolean(startupId),
  });
}

export function useEvidence(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.evidence(startupId ?? ''),
    queryFn: () => fetchEvidence(startupId as string),
    enabled: Boolean(startupId),
  });
}
