import { Link } from 'react-router';
import { History } from 'lucide-react';
import { formatDate } from '@/domain/dates';
import { stageName } from '@/domain/journey';
import { reviewHistory, type StageReview } from '@/domain/reviews';
import { ReviewStatusPill } from './ReviewStatusPill';

interface ReviewHistoryProps {
  reviews: readonly StageReview[];
  /** Founders see "Reviewed by innoWIUT"; admins see the reviewer's name. */
  audience: 'founder' | 'admin';
  requirementTitles?: Record<string, string>;
  /** Admin: link to each review. */
  reviewHref?: (review: StageReview) => string;
}

/** Immutable record of every review request and decision, newest first. */
export function ReviewHistory({
  reviews,
  audience,
  requirementTitles,
  reviewHref,
}: ReviewHistoryProps) {
  const list = reviewHistory(reviews);
  if (list.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <History className="h-4 w-4 text-subtle" aria-hidden="true" />
        No stage reviews yet.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-line" aria-label="Review history">
      {list.map((review) => {
        const decided = review.status !== 'pending';
        const attention = review.attention_requirement_ids
          .map((id) => requirementTitles?.[id])
          .filter(Boolean);
        const by = audience === 'admin' ? review.reviewer_name || 'innoWIUT admin' : 'innoWIUT';
        const title = `${stageName(review.from_stage)} → ${stageName(review.to_stage)}`;
        return (
          <li key={review.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13.5px] font-semibold text-ink">
                {reviewHref ? (
                  <Link to={reviewHref(review)} className="hover:text-primary hover:underline">
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </p>
              <ReviewStatusPill state={review.status} />
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              {decided
                ? `${formatDate(review.reviewed_at)} · Reviewed by ${by}`
                : `Requested ${formatDate(review.requested_at)} · Waiting for review`}
            </p>
            {review.feedback && (
              <p className="mt-1.5 border-l-2 border-line-strong pl-3 text-[13px] leading-6 text-ink">
                “{review.feedback}”
              </p>
            )}
            {review.admin_note && (
              <p className="mt-1.5 text-[12.5px] text-muted">Note: {review.admin_note}</p>
            )}
            {attention.length > 0 && (
              <p className="mt-1 text-[12px] text-muted">Needs attention: {attention.join(', ')}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
