import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  MessageSquareWarning,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/domain/dates';
import { stageName, type StageKey } from '@/domain/journey';
import type { StageReviewInfo } from '@/domain/reviews';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { requestStageReview } from '../api';
import { ReviewStatusPill } from './ReviewStatusPill';

interface StageReviewCardProps {
  startupId: string;
  current: StageKey;
  info: StageReviewInfo;
  /** Every required requirement of the current stage is completed. */
  stageComplete: boolean;
  requirementTitles: Record<string, string>;
  onUpdateEvidence: () => void;
  onContinue: () => void;
}

const shell = 'rounded-xl border bg-white p-5 shadow-card sm:p-6';
const eyebrow = 'text-[10.5px] font-semibold tracking-[0.16em] uppercase';

/**
 * The founder's side of a stage review: request it when the stage is complete, see it
 * pending, act on feedback and resubmit, or continue after approval. Nothing here moves
 * the stage — only an innoWIUT approval does.
 */
export function StageReviewCard({
  startupId,
  current,
  info,
  stageComplete,
  requirementTitles,
  onUpdateEvidence,
  onContinue,
}: StageReviewCardProps) {
  const queryClient = useQueryClient();
  const request = useMutation({
    mutationFn: () => requestStageReview(startupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.reviews(startupId) });
      toast.success('Review requested. innoWIUT will review your progress.');
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.reviews(startupId) });
      toast.error(errorMessage(error, "We couldn't request a review. Please try again."));
    },
  });

  const name = stageName(current);
  const next = info.nextStage ? stageName(info.nextStage) : null;
  const review = info.review;

  if (info.state === 'ready') {
    return (
      <section aria-labelledby="stage-review-title" className={cn(shell, 'border-primary/40')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="stage-review-title" className={cn(eyebrow, 'text-primary')}>
                Stage ready for review
              </h2>
              <p className="mt-1.5 text-[15px] font-semibold text-ink">
                You have completed all required milestones for {name}.
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                innoWIUT will review your progress before you move to the next stage
                {next ? ` (${next})` : ''}.
              </p>
            </div>
          </div>
          <ReviewStatusPill state="ready" />
        </div>
        <Button className="mt-4" onClick={() => request.mutate()} loading={request.isPending}>
          Request Stage Review
        </Button>
      </section>
    );
  }

  if (info.state === 'pending' && review) {
    return (
      <section aria-labelledby="stage-review-title" className={cn(shell, 'border-line')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning-strong">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="stage-review-title" className={cn(eyebrow, 'text-muted')}>
                Stage review
              </h2>
              <p className="mt-1.5 text-[15px] font-semibold text-ink">
                Your {name} stage is under review
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                Requested {formatDate(review.requested_at, 'long')}. You can keep adding evidence
                while innoWIUT reviews it.
              </p>
            </div>
          </div>
          <ReviewStatusPill state="pending" />
        </div>
        <Button className="mt-4" disabled>
          Review Requested
        </Button>
      </section>
    );
  }

  if (info.state === 'needs_work' && review) {
    const attention = review.attention_requirement_ids
      .map((id) => requirementTitles[id])
      .filter(Boolean);
    const resubmitFirst = info.improvedSinceFeedback && stageComplete;
    return (
      <section aria-labelledby="stage-review-title" className={cn(shell, 'border-danger/25')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger-strong">
              <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="stage-review-title" className={cn(eyebrow, 'text-danger-strong')}>
                Needs work
              </h2>
              <p className="mt-1.5 text-[15px] font-semibold text-ink">
                innoWIUT reviewed your {name} stage
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                Reviewed {formatDate(review.reviewed_at, 'long')} by{' '}
                {review.reviewer_name || 'innoWIUT'}. Your stage stays {name} until a review is
                approved.
              </p>
            </div>
          </div>
          <ReviewStatusPill state="needs_work" />
        </div>
        <div className="mt-4 rounded-lg bg-canvas-subtle px-4 py-3">
          <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
            Admin feedback
          </p>
          <p className="mt-1 text-[13.5px] leading-6 whitespace-pre-line text-ink">
            {review.feedback}
          </p>
          {attention.length > 0 && (
            <div className="mt-3">
              <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                Requirements that need attention
              </p>
              <ul className="mt-1 list-disc pl-5 text-[13px] text-ink">
                {attention.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={resubmitFirst ? 'outline' : 'primary'} onClick={onUpdateEvidence}>
            Update Evidence
          </Button>
          <Button
            variant={resubmitFirst ? 'primary' : 'outline'}
            onClick={() => request.mutate()}
            loading={request.isPending}
            disabled={!stageComplete}
          >
            Resubmit for Review
          </Button>
        </div>
        {!stageComplete && (
          <p className="mt-2 text-[12px] text-muted">
            Complete every required milestone again before resubmitting.
          </p>
        )}
      </section>
    );
  }

  if (info.state === 'approved' && review) {
    return (
      <section aria-labelledby="stage-review-title" className={cn(shell, 'border-success/30')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="stage-review-title" className={cn(eyebrow, 'text-success')}>
                Stage approved
              </h2>
              <p className="mt-1.5 text-[15px] font-semibold text-ink">
                {stageName(review.from_stage)} completed
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                Next stage: <span className="font-medium text-ink">{name}</span> · Approved{' '}
                {formatDate(review.reviewed_at, 'long')}
              </p>
              {review.admin_note && (
                <p className="mt-2 text-[13px] text-ink">“{review.admin_note}”</p>
              )}
            </div>
          </div>
          <ReviewStatusPill state="approved" />
        </div>
        <Button className="mt-4" onClick={onContinue}>
          Continue to {name} <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    );
  }

  return null;
}
