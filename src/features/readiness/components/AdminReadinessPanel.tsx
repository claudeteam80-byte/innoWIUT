import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarClock } from 'lucide-react';
import { paths } from '@/app/paths';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/domain/dates';
import type { StageKey } from '@/domain/journey';
import { readinessCompletion } from '@/domain/readiness';
import { reviewHistory, stageReviewInfo, type StageReview } from '@/domain/reviews';
import { StageProgressBar } from '@/features/journey/components/CurrentStageCard';
import { ReviewStatusPill } from '@/features/reviews/components/ReviewStatusPill';
import type { AdminInterview } from '../api';
import { useAdminInterview, useReadinessState } from '../hooks';
import { INTERVIEW_STATUS, formatDateTime } from '../ui-helpers';
import { LocationValue } from './ReadinessCards';
import { InterviewDialog } from './InterviewDialog';

/** Interview details for admins (including the admin-only note). */
export function InterviewSummary({ interview }: { interview: AdminInterview | null }) {
  const status = interview?.status ?? 'not_required';
  const meta = INTERVIEW_STATUS[status];
  return (
    <div className="space-y-2 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">Interview</span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      {interview && status !== 'not_required' && (
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11.5px] font-medium text-muted">Date & time</dt>
            <dd className="text-ink">{formatDateTime(interview.scheduled_at)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-medium text-muted">Location or link</dt>
            <dd className="text-ink">
              <LocationValue value={interview.location_or_link} />
            </dd>
          </div>
          {interview.completed_at && (
            <div>
              <dt className="text-[11.5px] font-medium text-muted">Completed</dt>
              <dd className="text-ink">{formatDate(interview.completed_at, 'long')}</dd>
            </div>
          )}
        </dl>
      )}
      {interview?.admin_note && (
        <p className="text-ink">
          <span className="text-muted">Admin note:</span> {interview.admin_note}
        </p>
      )}
    </div>
  );
}

/** Schedule / update button + dialog; only while the startup is in Investor Readiness. */
export function InterviewAction({
  startupId,
  startupName,
  interview,
  size = 'sm',
  variant = 'outline',
}: {
  startupId: string;
  startupName: string;
  interview: AdminInterview | null;
  size?: 'sm' | 'md';
  variant?: 'outline' | 'primary';
}) {
  const [open, setOpen] = useState(false);
  const scheduled = interview && interview.status !== 'not_required';
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <CalendarClock aria-hidden="true" /> {scheduled ? 'Update Interview' : 'Schedule Interview'}
      </Button>
      <InterviewDialog
        open={open}
        onOpenChange={setOpen}
        startupId={startupId}
        startupName={startupName}
        interview={interview}
      />
    </>
  );
}

/**
 * Admin Journey tab: readiness completion and status, review history link, interview and the
 * Investor Ready date. Read-only apart from the optional interview.
 */
export function AdminReadinessPanel({
  startupId,
  startupName,
  current,
  reviews,
}: {
  startupId: string;
  startupName: string;
  current: StageKey;
  reviews: readonly StageReview[];
}) {
  const state = useReadinessState(startupId);
  const interview = useAdminInterview(startupId);
  if (state.isError || interview.isError) {
    return <ErrorState onRetry={() => void Promise.all([state.refetch(), interview.refetch()])} />;
  }
  if (!state.data || interview.data === undefined) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }
  const completion = readinessCompletion(state.data);
  const readinessReviews = reviewHistory(reviews).filter(
    (r) => r.review_type === 'investor_readiness',
  );
  const pending = readinessReviews.find((r) => r.status === 'pending') ?? null;
  const approved = readinessReviews.find((r) => r.status === 'approved') ?? null;
  const info =
    current === 'investor_access'
      ? { state: 'approved' as const }
      : stageReviewInfo({
          current: 'investor_readiness',
          reviews,
          progress: completion,
          approvalUntilActivity: true,
        });

  return (
    <Card>
      <CardHeader
        title="Investor Readiness"
        description="Only an approved readiness review moves this startup to Investor Access."
        action={
          pending ? (
            <Link
              to={paths.admin.reviewDetail(pending.id)}
              className={buttonClasses({ size: 'sm' })}
            >
              Open Review
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
            <span className="text-muted">Readiness completion</span>
            <span className="font-semibold text-ink">{completion.percent}% complete</span>
          </div>
          <StageProgressBar percent={completion.percent} label="Readiness completion" />
          <p className="text-[12.5px] text-muted">
            {completion.completed} of {completion.total} mandatory requirements ·{' '}
            {completion.missing} missing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">Status</span>
          <ReviewStatusPill
            state={info.state === 'approved' && !approved ? 'not_ready' : info.state}
            type="investor_readiness"
          />
          {approved?.reviewed_at && (
            <span className="text-muted">
              Investor Ready {formatDate(approved.reviewed_at, 'long')}
            </span>
          )}
          <span className="text-muted">
            · {readinessReviews.length} readiness{' '}
            {readinessReviews.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-canvas-subtle px-4 py-3">
          <InterviewSummary interview={interview.data} />
          {current === 'investor_readiness' && (
            <InterviewAction
              startupId={startupId}
              startupName={startupName}
              interview={interview.data}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
