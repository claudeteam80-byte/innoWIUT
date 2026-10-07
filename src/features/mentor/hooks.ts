import { useQuery } from '@tanstack/react-query';
import { founderKeys } from '@/features/founder-keys';
import { fetchAssignedMentor, fetchMeetingRequests, fetchMentorNotes } from './api';

export function useAssignedMentor(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.mentor(startupId ?? ''),
    queryFn: () => fetchAssignedMentor(startupId as string),
    enabled: Boolean(startupId),
  });
}

export function useMentorNotes(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.notes(startupId ?? ''),
    queryFn: () => fetchMentorNotes(startupId as string),
    enabled: Boolean(startupId),
  });
}

export function useMeetingRequests(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.meetings(startupId ?? ''),
    queryFn: () => fetchMeetingRequests(startupId as string),
    enabled: Boolean(startupId),
  });
}
