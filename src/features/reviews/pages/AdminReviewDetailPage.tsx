import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ClipboardCheck, FileText, Paperclip } from 'lucide-react';
import { paths } from '@/app/paths';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/domain/dates';
import { evidenceFor, stageName, stageProgress } from '@/domain/journey';
import { daysWaiting, type ReviewState } from '@/domain/reviews';
import { InfoGrid } from '@/features/admin/components/InfoGrid';
import { TractionTab } from '@/features/admin/components/StartupTabs';
import { usePublishedUpdates } from '@/features/admin/hooks';
import { StageProgressBar } from '@/features/journey/components/CurrentStageCard';
import { EvidenceList } from '@/features/journey/components/EvidenceList';
import { StatusBadge } from '@/features/journey/components/RequirementList';
import { useEvidence, useRequirements } from '@/features/journey/hooks';
import { useMetrics } from '@/features/traction/hooks';
import { UpdateCard } from '@/features/updates/components/UpdateCard';
import { useUpdateContext } from '@/features/updates/hooks';
import { useDocumentTitle } from '@/lib/document-title';
import { publicFileUrl } from '@/lib/storage';
import { ApproveDialog, NeedsWorkDialog } from '../components/DecisionDialogs';
import { READINESS_SECTIONS, sectionName } from '@/domain/readiness';
import { InterviewAction } from '@/features/readiness/components/AdminReadinessPanel';
import { ReadinessReviewDetail } from '@/features/readiness/components/ReadinessReviewDetail';
import { useAdminInterview, useReadinessState } from '@/features/readiness/hooks';
import { ReviewHistory } from '../components/ReviewHistory';
import { ReviewStatusPill } from '../components/ReviewStatusPill';
import { useReview, useStartupReviews } from '../hooks';

function Section({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={`${number}. ${title}`} description={description} />
      {children}
    </Card>
  );
}

/** Everything an admin needs to decide a stage review, with a sticky decision panel. */
export function AdminReviewDetailPage() {
  const { reviewId = '' } = useParams();
  const review = useReview(reviewId);
  const startupId = review.data?.startup_id;
  const requirements = useRequirements(startupId);
  const evidence = useEvidence(startupId);
  const metrics = useMetrics(startupId);
  const updates = usePublishedUpdates(startupId ?? '');
  const history = useStartupReviews(startupId);
  const context = useUpdateContext(startupId);
  const isReadiness = review.data?.review_type === 'investor_readiness';
  const readinessState = useReadinessState(startupId, isReadiness);
  const interview = useAdminInterview(startupId, isReadiness);
  const [dialog, setDialog] = useState<'approve' | 'needs_work' | null>(null);
  useDocumentTitle(review.data?.startup?.name ? `Review · ${review.data.startup.name}` : 'Review');

  const back = (
    <Link
      to={paths.admin.reviews}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Reviews
    </Link>
  );

  if (review.isError) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState onRetry={() => void review.refetch()} />
      </div>
    );
  }
  if (review.isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading review">
        {back}
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!review.data || !review.data.startup) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={ClipboardCheck}
          title="Review not found"
          description="It may have been removed."
        />
      </div>
    );
  }

  const data = review.data;
  const startup = data.startup!;
  const state = data.status as ReviewState;
  const from = stageName(data.from_stage);
  const to = stageName(data.to_stage);
  const rows = requirements.data ?? [];
  const progress = stageProgress(data.from_stage, rows);
  const stageEvidence = (evidence.data ?? []).filter((e) => e.stage === data.from_stage);
  const readinessRows = readinessState.data ?? [];
  const titles = {
    ...Object.fromEntries(readinessRows.map((r) => [r.requirement_id, r.title])),
    ...Object.fromEntries(rows.map((r) => [r.id, r.title])),
  };
  const type = data.review_type;
  const published = (updates.data ?? []).filter((u) => u.status === 'published');
  const stageUpdates = published.filter((u) => u.linked_stage === data.from_stage);
  const planSource =
    stageUpdates.find((u) => u.blocker || u.next_milestone) ??
    published.find((u) => u.blocker || u.next_milestone || u.challenge || u.next_steps) ??
    null;
  const otherReviews = (history.data ?? []).filter((r) => r.id !== data.id);

  return (
    <div className="space-y-6">
      {back}
      <header className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
        <Avatar
          name={startup.name}
          src={publicFileUrl('startup-logos', startup.logo_path)}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            <Link to={paths.admin.startupDetail(startup.id)} className="hover:underline">
              {startup.name}
            </Link>
          </h1>
          <p className="mt-0.5 text-[14px] font-medium text-muted">
            {isReadiness ? 'Investor Readiness review' : `${from} → ${to}`}
          </p>
        </div>
        <ReviewStatusPill state={state} type={type} className="self-start sm:self-center" />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isReadiness ? (
            <ReadinessReviewDetail
              review={data}
              startupId={startup.id}
              evidence={evidence.data ?? []}
              metrics={metrics.data ?? []}
              updates={updates.data ?? []}
              updateContext={context}
              interview={interview.data}
            />
          ) : (
            <>
              <Section number={1} title="Stage summary">
                <InfoGrid
                  items={[
                    { label: 'Current stage', value: stageName(startup.journey_stage) },
                    { label: 'Reviewing', value: `${from} → ${to}` },
                    {
                      label: 'Stage completion',
                      value: `${progress.completed} of ${progress.total} required (${data.requirements_completed}/${data.requirements_total} when requested)`,
                    },
                    {
                      label: 'Requested',
                      value:
                        state === 'pending'
                          ? `${formatDate(data.requested_at, 'long')} · ${daysWaiting(data.requested_at)} days waiting`
                          : formatDate(data.requested_at, 'long'),
                    },
                    {
                      label: 'Founder',
                      value: startup.owner
                        ? `${startup.owner.full_name || '—'} · ${startup.owner.email}`
                        : null,
                      wide: true,
                    },
                  ]}
                />
                <div className="mt-4">
                  <StageProgressBar percent={progress.percent} label={`${from} progress`} />
                </div>
              </Section>

              <Section
                number={2}
                title="Requirements"
                description={`What innoWIUT looks for at ${from}.`}
              >
                {requirements.isError ? (
                  <ErrorState onRetry={() => void requirements.refetch()} />
                ) : requirements.isPending ? (
                  <Skeleton className="h-32 w-full" />
                ) : progress.rows.length === 0 ? (
                  <p className="text-[13px] text-muted">No requirements for this stage.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {progress.rows.map((row) => {
                      const count = evidenceFor(row.id, evidence.data ?? []).length;
                      return (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium text-ink">{row.title}</p>
                            <p className="text-[12px] text-muted">
                              {count} evidence {count === 1 ? 'item' : 'items'} · Last updated{' '}
                              {formatDate(row.updated_at)}
                              {row.progress_target !== null &&
                                ` · ${row.progress_value ?? 0}/${row.progress_target}`}
                            </p>
                          </div>
                          <StatusBadge status={row.status} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

              <Section
                number={3}
                title={`Evidence (${stageEvidence.length})`}
                description="Added by the founder. Read-only."
              >
                {stageEvidence.length === 0 ? (
                  <EmptyState icon={Paperclip} title="No evidence for this stage." />
                ) : (
                  <EvidenceList
                    items={stageEvidence}
                    metrics={metrics.data}
                    requirementTitles={titles}
                  />
                )}
              </Section>

              <section aria-labelledby="review-traction" className="space-y-3">
                <h2 id="review-traction" className="text-[15px] font-semibold text-ink">
                  4. Traction
                </h2>
                <TractionTab startupId={startup.id} />
              </section>

              <Section
                number={5}
                title="Recent founder updates"
                description={`Published updates linked to ${from}.`}
              >
                {updates.isPending ? (
                  <Skeleton className="h-24 w-full" />
                ) : stageUpdates.length === 0 ? (
                  <EmptyState icon={FileText} title="No updates linked to this stage." />
                ) : (
                  <div className="space-y-4">
                    {stageUpdates.slice(0, 3).map((update) => (
                      <UpdateCard key={update.id} update={update} context={context} />
                    ))}
                  </div>
                )}
              </Section>

              <Section
                number={6}
                title="Blockers & next milestone"
                description={
                  planSource
                    ? `From “${planSource.title}” (${formatDate(planSource.update_date)}).`
                    : undefined
                }
              >
                {planSource ? (
                  <InfoGrid
                    items={[
                      {
                        label: 'Blocker',
                        value: planSource.blocker ?? planSource.challenge ?? 'None reported',
                      },
                      {
                        label: 'Next milestone',
                        value: planSource.next_milestone
                          ? `${planSource.next_milestone}${planSource.next_milestone_date ? ` (target ${formatDate(planSource.next_milestone_date)})` : ''}`
                          : planSource.next_steps,
                      },
                    ]}
                  />
                ) : (
                  <p className="text-[13px] text-muted">
                    No blocker or milestone reported in published updates.
                  </p>
                )}
              </Section>
            </>
          )}

          {otherReviews.length > 0 && (
            <Card>
              <CardHeader title="Earlier reviews" description="This startup's review history." />
              <ReviewHistory
                reviews={otherReviews}
                audience="admin"
                requirementTitles={titles}
                reviewHref={(r) => paths.admin.reviewDetail(r.id)}
              />
            </Card>
          )}
        </div>

        <aside aria-label="Decision" className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            {state === 'pending' ? (
              <>
                <CardHeader
                  title="Decision"
                  description={
                    isReadiness
                      ? `Marking ${startup.name} Investor Ready unlocks Investor Access. Needs work keeps it in Investor Readiness.`
                      : `Approving moves ${startup.name} from ${from} to ${to}. Needs work keeps it at ${from}.`
                  }
                />
                <div className="grid gap-2">
                  <Button onClick={() => setDialog('approve')}>
                    {isReadiness ? 'Mark Investor Ready' : 'Approve Stage'}
                  </Button>
                  <Button variant="outline" onClick={() => setDialog('needs_work')}>
                    Needs Work
                  </Button>
                  {isReadiness &&
                    startup.journey_stage === 'investor_readiness' &&
                    interview.data !== undefined && (
                      <InterviewAction
                        startupId={startup.id}
                        startupName={startup.name}
                        interview={interview.data}
                        size="md"
                      />
                    )}
                </div>
              </>
            ) : (
              <>
                <CardHeader title="Decision" />
                <div className="space-y-3 text-[13px]">
                  <ReviewStatusPill state={state} type={type} />
                  <p className="text-muted">
                    {formatDate(data.reviewed_at, 'long')} by{' '}
                    {data.reviewer_name || 'innoWIUT admin'}
                  </p>
                  {data.feedback && (
                    <p className="border-l-2 border-line-strong pl-3 leading-6 text-ink">
                      “{data.feedback}”
                    </p>
                  )}
                  {data.admin_note && <p className="text-ink">Note: {data.admin_note}</p>}
                  {data.attention_sections.length > 0 && (
                    <p className="text-muted">
                      Sections: {data.attention_sections.map(sectionName).join(', ')}
                    </p>
                  )}
                  {isReadiness &&
                    state === 'needs_work' &&
                    startup.journey_stage === 'investor_readiness' &&
                    interview.data !== undefined && (
                      <InterviewAction
                        startupId={startup.id}
                        startupName={startup.name}
                        interview={interview.data}
                      />
                    )}
                  {data.attention_requirement_ids.length > 0 && (
                    <p className="text-muted">
                      Needs attention:{' '}
                      {data.attention_requirement_ids
                        .map((id) => titles[id])
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>
        </aside>
      </div>

      <ApproveDialog
        open={dialog === 'approve'}
        onOpenChange={(open) => !open && setDialog(null)}
        review={data}
        startupName={startup.name}
      />
      <NeedsWorkDialog
        open={dialog === 'needs_work'}
        onOpenChange={(open) => !open && setDialog(null)}
        review={data}
        startupName={startup.name}
        requirements={
          isReadiness
            ? readinessRows.map((r) => ({ id: r.requirement_id, title: r.title }))
            : progress.rows
        }
        sections={isReadiness ? READINESS_SECTIONS : []}
      />
    </div>
  );
}
