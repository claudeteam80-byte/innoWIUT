import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  Paperclip,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { paths } from '@/app/paths';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  investorAccessSummary,
  readinessCompletion,
  readinessSummary,
  type ReadinessNextAction,
} from '@/domain/readiness';
import { canRequestReview, journeyReviewSummary, reviewHistory } from '@/domain/reviews';
import {
  getStage,
  isStageKey,
  progressText,
  nextAction,
  stagePosition,
  stageProgress,
  type StageEvidence,
  type StageKey,
  type StageRequirement,
} from '@/domain/journey';
import { founderKeys } from '@/features/founder-keys';
import { useMyStartup } from '@/features/startup/hooks';
import { useMetrics } from '@/features/traction/hooks';
import { ReviewHistory } from '@/features/reviews/components/ReviewHistory';
import { StageReviewCard } from '@/features/reviews/components/StageReviewCard';
import { useStartupReviews } from '@/features/reviews/hooks';
import { InvestorAccessCard } from '@/features/readiness/components/ReadinessCards';
import { ReadinessReviewCard } from '@/features/readiness/components/ReadinessReviewCard';
import { ReadinessView } from '@/features/readiness/components/ReadinessView';
import { useReadinessData } from '@/features/readiness/hooks';
import { UpdateCard } from '@/features/updates/components/UpdateCard';
import { UpdateDialog } from '@/features/updates/components/UpdateDialog';
import { useUpdateContext, useUpdates } from '@/features/updates/hooks';
import { errorMessage } from '@/lib/errors';
import { deleteEvidence } from '../api';
import { CurrentStageCard, StageProgressBar } from '../components/CurrentStageCard';
import { EvidenceDialog } from '../components/EvidenceDialog';
import { EvidenceList } from '../components/EvidenceList';
import { RequirementDialog } from '../components/RequirementDialog';
import { RequirementList } from '../components/RequirementList';
import { StageTracker } from '../components/StageTracker';
import { TractionMetricsDialog } from '../components/TractionMetricsDialog';
import { useEvidence, useRequirements } from '../hooks';

const positionBadge = {
  completed: { label: 'Earlier stage', tone: 'neutral' },
  current: { label: 'Current stage', tone: 'blue' },
  upcoming: { label: 'Upcoming stage', tone: 'neutral' },
  locked: { label: 'Locked', tone: 'neutral' },
} as const;

type DialogState =
  | { kind: 'requirement'; row: StageRequirement }
  | { kind: 'evidence'; row: StageRequirement | null }
  | { kind: 'traction' }
  | { kind: 'update' }
  | null;

export function JourneyPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startup = useMyStartup();
  const startupId = startup.data?.id;
  const requirements = useRequirements(startupId);
  const evidence = useEvidence(startupId);
  const metrics = useMetrics(startupId);
  const updates = useUpdates(startupId);
  const reviews = useStartupReviews(startupId);
  const context = useUpdateContext(startupId);
  const investorStage =
    startup.data?.journey_stage === 'investor_readiness' ||
    startup.data?.journey_stage === 'investor_access';
  const readiness = useReadinessData(startupId, investorStage);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [removing, setRemoving] = useState<StageEvidence | null>(null);

  const remove = useMutation({
    mutationFn: (item: StageEvidence) => deleteEvidence([item]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.evidence(startupId ?? '') });
      setRemoving(null);
      toast.success('Evidence removed.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't remove this evidence.")),
  });

  const header = (
    <PageHeader
      eyebrow="Journey"
      title="Startup Journey"
      subtitle="Build evidence, prove progress and move your startup forward."
      actions={
        <Button
          variant="outline"
          onClick={() => setDialog({ kind: 'update' })}
          disabled={!startupId}
        >
          <FileText aria-hidden="true" /> Post Update
        </Button>
      }
    />
  );

  const failed =
    [startup, requirements, evidence, metrics, reviews].find((q) => q.isError) ?? readiness.failed;
  if (failed) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState onRetry={() => void failed.refetch()} />
      </div>
    );
  }
  if (
    !startup.data ||
    !requirements.data ||
    !evidence.data ||
    !metrics.data ||
    !reviews.data ||
    (investorStage && !readiness.data)
  ) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your journey">
        {header}
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const current = startup.data.journey_stage;
  const requested = params.stage;
  const selectedKey: StageKey =
    isStageKey(requested) && !getStage(requested).locked ? requested : current;
  const stage = getStage(selectedKey);
  const rows = requirements.data;
  const allEvidence = evidence.data;
  const metricList = metrics.data;
  const ready = readiness.data;
  const inReadiness = current === 'investor_readiness' && ready !== null;
  const summary =
    current === 'investor_access'
      ? investorAccessSummary(reviews.data)
      : inReadiness
        ? readinessSummary({
            rows: ready.rows,
            reviews: reviews.data,
            requirements: ready.requirements,
            profile: ready.profile,
            evidence: allEvidence,
            interview: ready.interview,
          })
        : journeyReviewSummary({
            current,
            requirements: rows,
            metrics: metricList,
            reviews: reviews.data,
            evidence: allEvidence,
          });
  const readinessReview = inReadiness ? summary.review.review : null;
  const readinessTitles = Object.fromEntries(
    (ready?.rows ?? []).map((r) => [r.requirement_id, r.title]),
  );
  const investorReady = reviewHistory(reviews.data).find(
    (r) => r.review_type === 'investor_readiness' && r.status === 'approved',
  );
  const currentProgress = stageProgress(current, rows);
  const attentionIds =
    summary.review.state === 'needs_work' && selectedKey === current
      ? (summary.review.review?.attention_requirement_ids ?? [])
      : [];
  const goToRequirements = () => {
    if (selectedKey !== current) void navigate(paths.founder.journeyStage(current));
    window.setTimeout(
      () => document.getElementById('stage-requirements')?.scrollIntoView({ behavior: 'smooth' }),
      50,
    );
  };
  const goToReadiness = () => {
    if (selectedKey !== 'investor_readiness') {
      void navigate(paths.founder.journeyStage('investor_readiness'));
    }
    window.setTimeout(
      () => document.getElementById('readiness-title')?.scrollIntoView({ behavior: 'smooth' }),
      50,
    );
  };
  const progress = stageProgress(selectedKey, rows);
  const next = nextAction(selectedKey, rows, metricList);
  const position = stagePosition(selectedKey, current);
  const stageEvidence = allEvidence.filter((item) => item.stage === selectedKey);
  const titles = { ...readinessTitles, ...Object.fromEntries(rows.map((r) => [r.id, r.title])) };
  const stageUpdates = (updates.data ?? [])
    .filter((u) => u.linked_stage === selectedKey)
    .slice(0, 3);
  const nextRow = rows.find((r) => r.id === next.requirementId) ?? null;

  const openNext = () => {
    if (next.kind === 'choose_metrics' || next.kind === 'link_metric') {
      setDialog(
        next.kind === 'link_metric' && nextRow
          ? { kind: 'requirement', row: nextRow }
          : { kind: 'traction' },
      );
    } else if (next.kind === 'record_metric') {
      void navigate(paths.founder.traction);
    } else if (nextRow) {
      setDialog({ kind: 'requirement', row: nextRow });
    }
  };

  return (
    <div className="space-y-6">
      {header}

      <CurrentStageCard
        summary={summary}
        pillType={summary.review.review?.review_type}
        reviewType={inReadiness || current === 'investor_access' ? 'investor_readiness' : 'stage'}
        reviewState={
          canRequestReview(current) || summary.review.state !== 'not_ready'
            ? summary.review.state
            : undefined
        }
        action={
          selectedKey !== current ? (
            <Button onClick={() => void navigate(paths.founder.journeyStage(current))}>
              Continue Journey <ArrowRight aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      {current === 'investor_access' ? (
        <InvestorAccessCard approvedAt={investorReady?.reviewed_at} />
      ) : inReadiness && summary.review.state !== 'approved' ? (
        <ReadinessReviewCard
          startupId={startup.data.id}
          info={summary.review}
          complete={summary.isComplete}
          missing={summary.total - summary.completed}
          requirementTitles={readinessTitles}
          onUpdate={goToReadiness}
        />
      ) : (
        <StageReviewCard
          startupId={startup.data.id}
          current={current}
          info={summary.review}
          stageComplete={inReadiness ? summary.isComplete : currentProgress.isComplete}
          requirementTitles={titles}
          onUpdateEvidence={goToRequirements}
          onContinue={inReadiness ? goToReadiness : goToRequirements}
        />
      )}

      <section aria-labelledby="stages-title" className="space-y-3">
        <h2 id="stages-title" className="text-[15px] font-semibold text-ink">
          Stages
        </h2>
        <StageTracker
          current={current}
          requirements={rows}
          readinessProgress={ready ? readinessCompletion(ready.rows) : undefined}
          selected={selectedKey}
          onSelect={(key) => void navigate(paths.founder.journeyStage(key))}
        />
        {current !== 'investor_access' && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Investor Access opens after innoWIUT approves your Investor Readiness.
          </p>
        )}
      </section>

      {selectedKey === 'investor_readiness' ? (
        ready ? (
          <ReadinessView
            startup={startup.data}
            data={ready}
            evidence={allEvidence}
            metrics={metricList}
            editable={current === 'investor_readiness'}
            next={inReadiness ? (summary.next as ReadinessNextAction) : null}
            attentionSections={
              summary.review.state === 'needs_work'
                ? (readinessReview?.attention_sections ?? [])
                : []
            }
            attentionRequirementIds={
              summary.review.state === 'needs_work'
                ? (readinessReview?.attention_requirement_ids ?? [])
                : []
            }
          />
        ) : (
          <Card>
            <EmptyState
              icon={Lock}
              title="Investor Readiness is an upcoming stage"
              description="It opens when innoWIUT approves your Traction stage review. Your profile, team, traction and journey evidence carry over — nothing is entered twice."
            />
          </Card>
        )
      ) : selectedKey === 'investor_access' ? null : (
        <>
          <section
            aria-labelledby="stage-detail-title"
            className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold tracking-[0.14em] text-subtle uppercase">
                  Journey · Stage {stage.number}
                </p>
                <h2
                  id="stage-detail-title"
                  className="mt-1 text-[20px] font-semibold tracking-tight text-ink"
                >
                  {stage.name}
                </h2>
                <p className="mt-0.5 text-[13px] text-muted">{stage.purpose}</p>
              </div>
              <Badge tone={positionBadge[position].tone}>{positionBadge[position].label}</Badge>
            </div>

            <div className="space-y-2">
              <StageProgressBar percent={progress.percent} label={`${stage.name} progress`} />
              <p className="text-[12.5px] text-muted">{progressText({ stage, ...progress })}</p>
            </div>

            {progress.isComplete ? (
              <div className="flex gap-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-success-strong"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[13.5px] font-semibold text-success-strong">
                    Stage requirements completed
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink/80">
                    {selectedKey !== current
                      ? 'Your evidence for this stage stays available.'
                      : canRequestReview(current)
                        ? `Your stage stays ${getStage(current).name} until innoWIUT approves a stage review.`
                        : 'Investor Readiness opens in a later phase — keep your traction evidence up to date.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-canvas-subtle px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                    Next action
                  </p>
                  <p className="mt-1 text-[13.5px] text-ink">{next.title}</p>
                </div>
                <Button size="sm" onClick={openNext}>
                  Continue <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            )}
          </section>

          <Card className="scroll-mt-6" id="stage-requirements">
            <CardHeader
              title="Requirements"
              description={
                stage.flexible
                  ? 'Choose the metrics that matter for your business. Revenue is not required.'
                  : 'What innoWIUT looks for at this stage.'
              }
              action={
                stage.flexible ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialog({ kind: 'traction' })}
                  >
                    <SlidersHorizontal aria-hidden="true" /> Select Metrics
                  </Button>
                ) : undefined
              }
            />
            {progress.rows.length === 0 ? (
              <EmptyState
                title="No traction metrics selected yet."
                description="Choose the metrics that prove market signal for your business — users, pilots, retention, revenue, partnerships."
                action={
                  <Button onClick={() => setDialog({ kind: 'traction' })}>Choose Metrics</Button>
                }
              />
            ) : (
              <RequirementList
                rows={progress.rows}
                evidence={allEvidence}
                metrics={metricList}
                highlightId={next.requirementId}
                attentionIds={attentionIds}
                onUpdate={(row) => setDialog({ kind: 'requirement', row })}
                onAddEvidence={(row) => setDialog({ kind: 'evidence', row })}
              />
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Evidence"
                description="What turns activity into proven progress."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialog({ kind: 'evidence', row: null })}
                  >
                    <Plus aria-hidden="true" /> Add Evidence
                  </Button>
                }
              />
              {stageEvidence.length === 0 ? (
                <EmptyState
                  icon={Paperclip}
                  title="No evidence yet."
                  description="Evidence is what turns activity into proven progress — a link, screenshot, metric or customer quote."
                />
              ) : (
                <EvidenceList
                  items={stageEvidence}
                  metrics={metricList}
                  requirementTitles={titles}
                  onDelete={setRemoving}
                  deletingId={remove.isPending ? (remove.variables?.id ?? null) : null}
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Recent progress updates"
                description={`Updates linked to ${stage.name}.`}
                action={
                  <Link
                    to={paths.founder.updates}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                  >
                    All updates <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                }
              />
              {updates.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : stageUpdates.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No updates linked to this stage yet."
                  description="Link an update to this stage so innoWIUT can follow the progress you are proving."
                  action={
                    <Button variant="outline" onClick={() => setDialog({ kind: 'update' })}>
                      <Plus aria-hidden="true" /> Post Update
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {stageUpdates.map((update) => (
                    <UpdateCard key={update.id} update={update} context={context} compact />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader
          title="Review History"
          description="Every stage review innoWIUT has received and decided."
        />
        <ReviewHistory reviews={reviews.data} audience="founder" requirementTitles={titles} />
      </Card>

      <RequirementDialog
        open={dialog?.kind === 'requirement'}
        onOpenChange={(open) => !open && setDialog(null)}
        startupId={startup.data.id}
        requirement={dialog?.kind === 'requirement' ? dialog.row : null}
        metrics={metricList}
      />
      <EvidenceDialog
        open={dialog?.kind === 'evidence'}
        onOpenChange={(open) => !open && setDialog(null)}
        startupId={startup.data.id}
        stage={selectedKey}
        requirements={progress.rows}
        metrics={metricList}
        requirement={dialog?.kind === 'evidence' ? dialog.row : null}
      />
      <TractionMetricsDialog
        open={dialog?.kind === 'traction'}
        onOpenChange={(open) => !open && setDialog(null)}
        startupId={startup.data.id}
        requirements={rows}
        metrics={metricList}
      />
      <UpdateDialog
        open={dialog?.kind === 'update'}
        onOpenChange={(open) => !open && setDialog(null)}
        startupId={startup.data.id}
        defaultStage={selectedKey}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove this evidence?"
        description="The evidence and any attached file will be permanently removed."
        confirmLabel="Remove evidence"
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  );
}
