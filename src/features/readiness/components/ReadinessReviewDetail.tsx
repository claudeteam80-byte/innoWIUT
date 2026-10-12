import { FileText, UserRound } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/domain/dates';
import type { StageEvidence } from '@/domain/journey';
import { readinessCompletion } from '@/domain/readiness';
import type { StageReview } from '@/domain/reviews';
import { daysWaiting } from '@/domain/reviews';
import { InfoGrid } from '@/features/admin/components/InfoGrid';
import { useAdminNotes, useAdminStartup, useAssignments } from '@/features/admin/hooks';
import { StageProgressBar } from '@/features/journey/components/CurrentStageCard';
import type { Metric } from '@/features/traction/api';
import { UpdateCard } from '@/features/updates/components/UpdateCard';
import type { useUpdateContext } from '@/features/updates/hooks';
import type { Tables } from '@/types/database';
import type { AdminInterview } from '../api';
import { useReadinessData } from '../hooks';
import { InterviewSummary } from './AdminReadinessPanel';
import { ReadinessSections } from './ReadinessSections';

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

interface Props {
  review: StageReview;
  startupId: string;
  evidence: readonly StageEvidence[];
  metrics: readonly Metric[];
  updates: readonly Tables<'startup_updates'>[];
  updateContext: ReturnType<typeof useUpdateContext>;
  interview: AdminInterview | null | undefined;
}

/**
 * Everything an admin reads before deciding an Investor Readiness review, in 13 sections:
 * startup summary, the nine readiness sections, founder updates, mentor context and the
 * interview. Read-only.
 */
export function ReadinessReviewDetail({
  review,
  startupId,
  evidence,
  metrics,
  updates,
  updateContext,
  interview,
}: Props) {
  const readiness = useReadinessData(startupId);
  const startup = useAdminStartup(startupId);
  const assignments = useAssignments(startupId);
  const notes = useAdminNotes(startupId);

  if (readiness.failed || startup.isError) {
    return (
      <ErrorState
        onRetry={() => void Promise.all([readiness.failed?.refetch(), startup.refetch()])}
      />
    );
  }
  if (!readiness.data || !startup.data) {
    return <Skeleton className="h-96 w-full rounded-xl" aria-label="Loading readiness" />;
  }

  const data = readiness.data;
  const s = startup.data;
  const completion = readinessCompletion(data.rows);
  const published = updates.filter((u) => u.status === 'published').slice(0, 3);
  const activeMentors = (assignments.data ?? []).filter((a) => !a.ended_at && a.mentor);
  const recentNotes = (notes.data ?? []).slice(0, 3);
  const attention = review.status === 'needs_work';

  return (
    <div className="space-y-6">
      <Section number={1} title="Startup summary">
        <InfoGrid
          items={[
            { label: 'Startup', value: s.name },
            { label: 'One-line description', value: s.tagline },
            { label: 'Industry', value: s.industry },
            {
              label: 'Readiness completion',
              value: `${completion.percent}% complete · ${completion.completed} of ${completion.total} mandatory (${review.requirements_completed}/${review.requirements_total} when requested)`,
            },
            {
              label: 'Requested',
              value:
                review.status === 'pending'
                  ? `${formatDate(review.requested_at, 'long')} · ${daysWaiting(review.requested_at)} days waiting`
                  : formatDate(review.requested_at, 'long'),
            },
            {
              label: 'Founder',
              value: s.owner ? `${s.owner.full_name || '—'} · ${s.owner.email}` : null,
            },
          ]}
        />
        <div className="mt-4">
          <StageProgressBar percent={completion.percent} label="Readiness completion" />
        </div>
      </Section>

      <ReadinessSections
        rows={data.rows}
        context={{
          startup: s,
          profile: data.profile,
          requirements: data.requirements,
          evidence,
          team: data.team,
          primaryMetricIds: data.primaryMetricIds,
        }}
        metrics={metrics}
        entries={data.entries}
        team={data.team}
        attentionSections={attention ? review.attention_sections : []}
        attentionRequirementIds={attention ? review.attention_requirement_ids : []}
        startNumber={2}
      />

      <Section number={11} title="Founder updates" description="Latest published updates.">
        {published.length === 0 ? (
          <EmptyState icon={FileText} title="No published updates yet." />
        ) : (
          <div className="space-y-4">
            {published.map((update) => (
              <UpdateCard key={update.id} update={update} context={updateContext} compact />
            ))}
          </div>
        )}
      </Section>

      <Section number={12} title="Mentor context">
        {assignments.isPending || notes.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : activeMentors.length === 0 && recentNotes.length === 0 ? (
          <EmptyState icon={UserRound} title="No mentor assigned and no mentor notes." />
        ) : (
          <div className="space-y-3 text-[13px]">
            {activeMentors.length > 0 && (
              <p className="text-ink">
                <span className="text-muted">Mentor:</span>{' '}
                {activeMentors.map((a) => a.mentor!.name).join(', ')}
              </p>
            )}
            {recentNotes.map((note) => (
              <div key={note.id} className="rounded-lg bg-canvas-subtle px-4 py-3">
                <p className="text-[11.5px] text-muted">
                  {formatDate(note.note_date)} · {note.mentor?.name ?? note.author?.full_name}
                </p>
                <p className="mt-1 leading-6 whitespace-pre-line text-ink">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section number={13} title="Interview status" description="Optional, arranged by innoWIUT.">
        {interview === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <InterviewSummary interview={interview} />
        )}
      </Section>
    </div>
  );
}
