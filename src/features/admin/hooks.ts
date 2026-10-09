import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchAdminNotes,
  fetchAssignments,
  fetchDashboardStats,
  fetchMeetingRequests,
  fetchMentors,
  fetchPublishedUpdates,
  fetchRecentUpdates,
  fetchStartup,
  fetchStartupActivity,
  fetchStageDistribution,
  fetchStartupList,
  type MeetingStatus,
  type StartupListParams,
} from './api';
import { adminKeys } from './keys';

export const useDashboardStats = () =>
  useQuery({ queryKey: adminKeys.stats, queryFn: fetchDashboardStats });

export const useStageDistribution = () =>
  useQuery({ queryKey: adminKeys.stageDistribution, queryFn: fetchStageDistribution });

export const useRecentUpdates = () =>
  useQuery({ queryKey: adminKeys.recentUpdates, queryFn: () => fetchRecentUpdates() });

export const useStartupList = (params: StartupListParams) =>
  useQuery({
    queryKey: adminKeys.startups(params),
    queryFn: () => fetchStartupList(params),
    placeholderData: keepPreviousData,
  });

export const useAdminStartup = (id: string) =>
  useQuery({ queryKey: adminKeys.startup(id), queryFn: () => fetchStartup(id) });

export const useStartupActivity = (id: string) =>
  useQuery({ queryKey: adminKeys.activity(id), queryFn: () => fetchStartupActivity(id) });

export const usePublishedUpdates = (id: string) =>
  useQuery({ queryKey: ['admin', 'updates', id], queryFn: () => fetchPublishedUpdates(id) });

export const useAssignments = (id: string) =>
  useQuery({ queryKey: adminKeys.assignments(id), queryFn: () => fetchAssignments(id) });

export const useAdminNotes = (id: string) =>
  useQuery({ queryKey: adminKeys.notes(id), queryFn: () => fetchAdminNotes(id) });

export const useMentors = () => useQuery({ queryKey: adminKeys.mentors, queryFn: fetchMentors });

export const useMeetingRequests = (status: MeetingStatus | 'all', page: number) =>
  useQuery({
    queryKey: adminKeys.meetings(status, page),
    queryFn: () => fetchMeetingRequests(status, page),
    placeholderData: keepPreviousData,
  });
