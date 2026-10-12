import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminKeys } from '@/features/admin/keys';
import { founderKeys } from '@/features/founder-keys';
import {
  fetchReview,
  fetchReviewQueue,
  fetchReviewStats,
  fetchStartupReviews,
  type ReviewQueueParams,
} from './api';

export function useStartupReviews(startupId: string | undefined) {
  return useQuery({
    queryKey: founderKeys.reviews(startupId ?? ''),
    queryFn: () => fetchStartupReviews(startupId as string),
    enabled: Boolean(startupId),
  });
}

export const useReviewQueue = (params: ReviewQueueParams) =>
  useQuery({
    queryKey: adminKeys.reviewQueue(params),
    queryFn: () => fetchReviewQueue(params),
    placeholderData: keepPreviousData,
  });

export const useReviewStats = () =>
  useQuery({ queryKey: adminKeys.reviewStats, queryFn: fetchReviewStats });

export const useReview = (id: string) =>
  useQuery({ queryKey: adminKeys.review(id), queryFn: () => fetchReview(id) });
