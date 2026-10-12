import type { StartupListParams } from './api';

export const adminKeys = {
  stats: ['admin', 'stats'] as const,
  stageDistribution: ['admin', 'stage-distribution'] as const,
  reviewStats: ['admin', 'review-stats'] as const,
  reviewQueue: (params: object) => ['admin', 'review-queue', params] as const,
  reviewQueueAll: ['admin', 'review-queue'] as const,
  review: (id: string) => ['admin', 'review', id] as const,
  recentUpdates: ['admin', 'recent-updates'] as const,
  startups: (params: StartupListParams) => ['admin', 'startups', params] as const,
  startupsAll: ['admin', 'startups'] as const,
  startup: (id: string) => ['admin', 'startup', id] as const,
  founder: (ownerId: string) => ['admin', 'founder', ownerId] as const,
  activity: (id: string) => ['admin', 'activity', id] as const,
  assignments: (id: string) => ['admin', 'assignments', id] as const,
  notes: (id: string) => ['admin', 'notes', id] as const,
  mentors: ['admin', 'mentors'] as const,
  meetings: (status: string, page: number) => ['admin', 'meetings', status, page] as const,
  meetingsAll: ['admin', 'meetings'] as const,
  readinessStats: ['admin', 'readiness-stats'] as const,
  interview: (startupId: string) => ['admin', 'interview', startupId] as const,
};
