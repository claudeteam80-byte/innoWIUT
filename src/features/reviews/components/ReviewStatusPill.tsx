import {
  REVIEW_STATE_META,
  reviewStateLabel,
  type ReviewState,
  type ReviewType,
} from '@/domain/reviews';
import { cn } from '@/lib/cn';

/**
 * Subtle status pill: Not Ready (gray), Ready (blue), Pending (amber), Needs Work, Approved.
 * An approved Investor Readiness review reads "Investor Ready".
 */
export function ReviewStatusPill({
  state,
  type = 'stage',
  className,
}: {
  state: ReviewState;
  type?: ReviewType;
  className?: string;
}) {
  const meta = REVIEW_STATE_META[state];
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium',
        meta.className,
        className,
      )}
    >
      {reviewStateLabel(state, type)}
    </span>
  );
}
