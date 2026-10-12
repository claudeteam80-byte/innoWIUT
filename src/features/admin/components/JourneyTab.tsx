import { useState } from 'react';
import { Link } from 'react-router';
import { FileText, Paperclip } from 'lucide-react';
import { paths } from '@/app/paths';
import { buttonClasses } from '@/components/ui/button-styles';
import { formatDate } from '@/domain/dates';
import { canRequestReview, journeyReviewSummary } from '@/domain/reviews';
import { ReviewHistory } from '@/features/reviews/components/ReviewHistory';
import { ReviewStatusPill } from '@/features/reviews/components/ReviewStatusPill';
import { useStartupReviews } from '@/features/reviews/hooks';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { getStage, progressText, stageProgress, type StageKey } from '@/domain/journey';
import { CurrentStageCard, StageProgressBar } from '@/features/journey/components/CurrentStageCard';
import { EvidenceList } from '@/features/journey/components/EvidenceList';
import { RequirementList } from '@/features/journey/components/RequirementList';
import { StageTracker } from '@/features/journey/components/StageTracker';
import { useEvidence, useRequirements } from '@/features/journey/hooks';
import { useMetrics } from '@/features/traction/hooks';
import { UpdateCard } from '@/features/updates/components/UpdateCard';
import { useUpdateContext } from '@/features/updates/hooks';
import { investorAccessSummary, readinessCompletion, readinessSummary } from '@/domain/readiness';
import { AdminReadinessPanel } from '@/features/readiness/components/AdminReadinessPanel';
import { ReadinessSections } from '@/features/readiness/components/ReadinessSections';
import { useReadinessData } from '@/features/readiness/hooks';
import { useAdminStartup, usePublishedUpdates } from '../hooks';

/**
 * Read-only view of a founder's journey. Admins see requirements, evidence (not evidence on
 * unpublished drafts — RLS) and published stage-linked updates. Nothing here writes.
 */
export function JourneyTab({
  startupId,
  startupName = 'This startup',
  current,
}: {
  startupId: string;
  startupName?: string;
  current: StageKey;
}) {
  const requirements = useRequirements(startupId);
  const evidence = useEvidence(startupId);
  const metrics = useMetrics(startupId);
  const updates = usePublishedUpdates(startupId);
  const context = useUpdateContext(startupId);
  const reviews = useStartupReviews(startupId);
  const [selected, setSelected] = useState<StageKey>(current);
  const investorStage = current === 'investor_readiness' || current === 'investor_access';
  const readiness = useReadinessData(startupId, investorStage);
  const startup = useAdminStartup(startupId);

  const failed =
    [requirements, evidence, metrics, reviews].find((q) => q.isError) ?? readiness.failed;
  if (failed) return <ErrorState onRetry={() => void failed.refetch()} />;
  if (
    !requirements.data ||
    !evidence.data ||
    !metrics.data ||
    !reviews.data ||
    (investorStage && !readiness.data)
  ) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading journey">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const rows = requirements.data;
  const ready = readiness.data;
  const summary =
    current === 'investor_access'
      ? investorAccessSummary(reviews.data)
      : current === 'investor_readiness' && ready
        ? readinessSummary({
            rows: ready.rows,
            reviews: reviews.data,
            requirements: ready.requirements,
            profile: ready.profile,
            evidence: evidence.data,
            interview: ready.interview,
          })
        : journeyReviewSummary({
            current,
            requirements: rows,
            metrics: metrics.data,
            reviews: reviews.data,
            evidence: evidence.data,
          });
  const reviewState = summary.review.state;
  const pending = reviews.data.find((r) => r.status === 'pending') ?? null;
  const latestFeedback =
    [...reviews.data]
      .filter((r) => r.status === 'needs_work')
      .sort((a, b) => b.requested_at.localeCompare(a.requested_at))[0] ?? null;
  const stage = getStage(selected);
  const progress = stageProgress(selected, rows);
  const stageEvidence = evidence.data.filter((item) => item.stage === selected);
  const titles = {
    ...Object.fromEntries((ready?.rows ?? []).map((r) => [r.requirement_id, r.title])),
    ...Object.fromEntries(rows.map((r) => [r.id, r.title])),
  };
  const stageUpdates = (updates.data ?? []).filter(
    (u) => u.status === 'published' && u.linked_stage === selected,
  );
  const notStarted = rows.every((r) => r.status === 'not_started') && evidence.data.length === 0;

  return (
    <div className="space-y-6">
      <CurrentStageCard
        summary={summary}
        reviewType={investorStage ? 'investor_readiness' : 'stage'}
        reviewState={
          canRequestReview(current) || reviewState !== 'not_ready' ? reviewState : undefined
        }
      />

      {investorStage ? (
        <AdminReadinessPanel
          startupId={startupId}
          startupName={startupName}
          current={current}
          reviews={reviews.data}
        />
      ) : (
        <Card>
          <CardHeader
            title="Stage review"
            description="Only an approved review moves this startup to the next stage."
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
          <div className="space-y-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">Review status</span>
              <ReviewStatusPill state={reviewState} />
              {pending && (
                <span className="text-muted">Requested {formatDate(pending.requested_at)}</span>
              )}
            </div>
            {latestFeedback && (
              <div className="rounded-lg bg-canvas-subtle px-4 py-3">
                <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                  Latest review feedback · {formatDate(latestFeedback.reviewed_at)}
                </p>
                <p className="mt-1 leading-6 text-ink">“{latestFeedback.feedback}”</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <section aria-labelledby="admin-stages" className="space-y-3">
        <h2 id="admin-stages" className="text-[15px] font-semibold text-ink">
          Stages
        </h2>
        <StageTracker
          current={current}
          requirements={rows}
          readinessProgress={ready ? readinessCompletion(ready.rows) : undefined}
          selected={selected}
          onSelect={setSelected}
        />
      </section>

      {notStarted && (
        <p className="rounded-lg bg-canvas px-4 py-3 text-[13px] text-muted">
          This founder has not started their journey requirements yet.
        </p>
      )}

      {selected === 'investor_readiness' && ready && startup.data ? (
        <ReadinessSections
          rows={ready.rows}
          context={{
            startup: startup.data,
            profile: ready.profile,
            requirements: ready.requirements,
            evidence: evidence.data,
            team: ready.team,
            primaryMetricIds: ready.primaryMetricIds,
          }}
          metrics={metrics.data}
          entries={ready.entries}
          team={ready.team}
        />
      ) : selected === 'investor_access' ? null : (
        <Card>
          <CardHeader
            title={`Stage progress · ${stage.name}`}
            description={progressText({ stage, ...progress })}
          />
          <div className="mb-5">
            <StageProgressBar percent={progress.percent} label={`${stage.name} progress`} />
            {progress.isComplete && (
              <p className="mt-2 text-[12.5px] font-medium text-success-strong">
                Stage requirements completed — the startup stays at {getStage(current).name} until
                an approved stage review.
              </p>
            )}
          </div>
          <h3 className="mb-3 text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
            Requirement status
          </h3>
          {progress.rows.length === 0 ? (
            <p className="text-[13px] text-muted">
              {stage.flexible
                ? 'The founder has not chosen traction metrics yet.'
                : 'No requirements for this stage.'}
            </p>
          ) : (
            <RequirementList rows={progress.rows} evidence={evidence.data} metrics={metrics.data} />
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={`Evidence (${stageEvidence.length})`}
            description="Added by the founder. Read-only."
          />
          {stageEvidence.length === 0 ? (
            <EmptyState icon={Paperclip} title="No evidence uploaded yet." />
          ) : (
            <EvidenceList items={stageEvidence} metrics={metrics.data} requirementTitles={titles} />
          )}
        </Card>
        <Card>
          <CardHeader
            title="Recent stage-related updates"
            description={`Published updates linked to ${stage.name}.`}
          />
          {updates.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : stageUpdates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No stage-linked updates yet."
              description="Updates this founder links to a stage will appear here."
            />
          ) : (
            <div className="space-y-4">
              {stageUpdates.slice(0, 5).map((update) => (
                <UpdateCard key={update.id} update={update} context={context} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Review History" description="Every stage review request and decision." />
        <ReviewHistory
          reviews={reviews.data}
          audience="admin"
          requirementTitles={titles}
          reviewHref={(review) => paths.admin.reviewDetail(review.id)}
        />
      </Card>
    </div>
  );
}
