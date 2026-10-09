import { useState } from 'react';
import { FileText, Paperclip } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  getStage,
  journeySummary,
  progressText,
  stageProgress,
  type StageKey,
} from '@/domain/journey';
import { CurrentStageCard, StageProgressBar } from '@/features/journey/components/CurrentStageCard';
import { EvidenceList } from '@/features/journey/components/EvidenceList';
import { RequirementList } from '@/features/journey/components/RequirementList';
import { StageTracker } from '@/features/journey/components/StageTracker';
import { useEvidence, useRequirements } from '@/features/journey/hooks';
import { useMetrics } from '@/features/traction/hooks';
import { UpdateCard } from '@/features/updates/components/UpdateCard';
import { useUpdateContext } from '@/features/updates/hooks';
import { usePublishedUpdates } from '../hooks';

/**
 * Read-only view of a founder's journey. Admins see requirements, evidence (not evidence on
 * unpublished drafts — RLS) and published stage-linked updates. Nothing here writes.
 */
export function JourneyTab({ startupId, current }: { startupId: string; current: StageKey }) {
  const requirements = useRequirements(startupId);
  const evidence = useEvidence(startupId);
  const metrics = useMetrics(startupId);
  const updates = usePublishedUpdates(startupId);
  const context = useUpdateContext(startupId);
  const [selected, setSelected] = useState<StageKey>(current);

  const failed = [requirements, evidence, metrics].find((q) => q.isError);
  if (failed) return <ErrorState onRetry={() => void failed.refetch()} />;
  if (!requirements.data || !evidence.data || !metrics.data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading journey">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const rows = requirements.data;
  const summary = journeySummary(current, rows, metrics.data);
  const stage = getStage(selected);
  const progress = stageProgress(selected, rows);
  const stageEvidence = evidence.data.filter((item) => item.stage === selected);
  const titles = Object.fromEntries(rows.map((r) => [r.id, r.title]));
  const stageUpdates = (updates.data ?? []).filter(
    (u) => u.status === 'published' && u.linked_stage === selected,
  );
  const notStarted = rows.every((r) => r.status === 'not_started') && evidence.data.length === 0;

  return (
    <div className="space-y-6">
      <CurrentStageCard summary={summary} />

      <section aria-labelledby="admin-stages" className="space-y-3">
        <h2 id="admin-stages" className="text-[15px] font-semibold text-ink">
          Stages
        </h2>
        <StageTracker
          current={current}
          requirements={rows}
          selected={selected}
          onSelect={setSelected}
        />
      </section>

      {notStarted && (
        <p className="rounded-lg bg-canvas px-4 py-3 text-[13px] text-muted">
          This founder has not started their journey requirements yet.
        </p>
      )}

      <Card>
        <CardHeader
          title={`Stage progress · ${stage.name}`}
          description={progressText({ stage, ...progress })}
        />
        <div className="mb-5">
          <StageProgressBar percent={progress.percent} label={`${stage.name} progress`} />
          {progress.isComplete && (
            <p className="mt-2 text-[12.5px] font-medium text-success-strong">
              Stage requirements completed — the startup stays at {getStage(current).name} until a
              stage review.
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
    </div>
  );
}
