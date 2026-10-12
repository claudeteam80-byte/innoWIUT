import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Clock, MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/domain/dates';
import { sectionName } from '@/domain/readiness';
import type { StageReviewInfo } from '@/domain/reviews';
import { founderKeys } from '@/features/founder-keys';
import { ReviewStatusPill } from '@/features/reviews/components/ReviewStatusPill';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { requestReadinessReview } from '../api';

const shell = 'rounded-xl border bg-white p-5 shadow-card sm:p-6';
const eyebrow = 'text-[10.5px] font-semibold tracking-[0.16em] uppercase';

interface Props {
  startupId: string;
  info: StageReviewInfo;
  complete: boolean;
  missing: number;
  requirementTitles: Record<string, string>;
  onUpdate: () => void;
}

/**
 * Founder side of the Investor Readiness review: request it once every mandatory requirement
 * is complete, see it pending, act on Needs Work and resubmit. Only an innoWIUT approval
 * ("Investor Ready") moves the startup to Investor Access.
 */
export function ReadinessReviewCard({
  startupId,
  info,
  complete,
  missing,
  requirementTitles,
  onUpdate,
}: Props) {
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: () => requestReadinessReview(startupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.reviews(startupId) });
      toast.success('Investor Readiness review requested. innoWIUT will review it.');
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.reviews(startupId) });
      toast.error(errorMessage(error, "We couldn't request the review. Please try again."));
    },
  });
  const review = info.review;

  if (info.state === 'pending' && review) {
    return (
      <section aria-labelledby="readiness-review-title" className={cn(shell, 'border-line')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning-strong">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="readiness-review-title" className={cn(eyebrow, 'text-muted')}>
                Investor Readiness review
              </h2>
              <p className="mt-1.5 text-[15px] font-semibold text-ink">
                Your Investor Readiness is under review
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                Requested {formatDate(review.requested_at, 'long')}. You can keep improving your
                materials while innoWIUT reviews them.
              </p>
            </div>
          </div>
          <ReviewStatusPill state="pending" type="investor_readiness" />
        </div>
        <Button className="mt-4" disabled>
          Review Requested
        </Button>
      </section>
    );
  }

  if (info.state === 'needs_work' && review) {
    const sections = review.attention_sections.map(sectionName);
    const requirements = review.attention_requirement_ids
      .map((id) => requirementTitles[id])
      .filter(Boolean);
    const resubmitFirst = info.improvedSinceFeedback && complete;
    return (
      <section aria-labelledby="readiness-review-title" className={cn(shell, 'border-danger/25')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger-strong">
              <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="readiness-review-title" className={cn(eyebrow, 'text-danger-strong')}>
                Needs work
              </h2>
              <p className="mt-1.5 text-[15px] font-semibold text-ink">
                innoWIUT reviewed your Investor Readiness
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                Reviewed {formatDate(review.reviewed_at, 'long')} by{' '}
                {review.reviewer_name || 'innoWIUT'}.
              </p>
            </div>
          </div>
          <ReviewStatusPill state="needs_work" type="investor_readiness" />
        </div>
        <div className="mt-4 space-y-3 rounded-lg bg-canvas-subtle px-4 py-3">
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
              innoWIUT feedback
            </p>
            <p className="mt-1 text-[13.5px] leading-6 whitespace-pre-line text-ink">
              {review.feedback}
            </p>
          </div>
          {sections.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                Sections that need attention
              </p>
              <p className="mt-1 text-[13px] text-ink">{sections.join(', ')}</p>
            </div>
          )}
          {requirements.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                Requirements that need attention
              </p>
              <ul className="mt-1 list-disc pl-5 text-[13px] text-ink">
                {requirements.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={resubmitFirst ? 'outline' : 'primary'} onClick={onUpdate}>
            Update Readiness
          </Button>
          <Button
            variant={resubmitFirst ? 'primary' : 'outline'}
            onClick={() => request.mutate()}
            loading={request.isPending}
            disabled={!complete}
          >
            Resubmit for Review
          </Button>
        </div>
        {!complete && (
          <p className="mt-2 text-[12px] text-muted">
            Complete every mandatory requirement before resubmitting ({missing} missing).
          </p>
        )}
      </section>
    );
  }

  const ready = info.state === 'ready';
  return (
    <section
      aria-labelledby="readiness-review-title"
      className={cn(shell, ready ? 'border-primary/40' : 'border-line')}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="readiness-review-title"
              className={cn(eyebrow, ready ? 'text-primary' : 'text-muted')}
            >
              Investor Readiness review
            </h2>
            <p className="mt-1.5 text-[15px] font-semibold text-ink">
              {ready
                ? 'Every mandatory requirement is complete.'
                : `${missing} mandatory ${missing === 1 ? 'requirement' : 'requirements'} left before review`}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              innoWIUT reviews your readiness before Investor Access opens.
            </p>
          </div>
        </div>
        <ReviewStatusPill state={ready ? 'ready' : 'not_ready'} type="investor_readiness" />
      </div>
      <Button
        className="mt-4"
        onClick={() => request.mutate()}
        loading={request.isPending}
        disabled={!ready}
      >
        Request Investor Readiness Review
      </Button>
    </section>
  );
}
