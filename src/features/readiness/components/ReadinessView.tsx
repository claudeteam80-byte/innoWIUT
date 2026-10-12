import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { paths } from '@/app/paths';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { StageEvidence } from '@/domain/journey';
import {
  readinessCompletion,
  sectionProgress,
  type ReadinessNextAction,
  type ReadinessSection,
} from '@/domain/readiness';
import { StageProgressBar } from '@/features/journey/components/CurrentStageCard';
import type { Startup } from '@/features/startup/api';
import type { Metric } from '@/features/traction/api';
import type { ReadinessData } from '../hooks';
import type { ProfileGroup } from '../schemas';
import type { ReadinessContext } from '../values';
import { PrimaryMetricsDialog } from './PrimaryMetrics';
import { ProfileSectionDialog } from './ProfileSectionDialog';
import { InterviewCard, ReadinessSummaryCard, SectionProgressGrid } from './ReadinessCards';
import { editTarget, type EditTarget } from '../ui-helpers';
import { ReadinessSections } from './ReadinessSections';
import { RequirementEditDialog } from './RequirementEditDialog';

interface Props {
  startup: Startup;
  data: ReadinessData;
  evidence: readonly StageEvidence[];
  metrics: readonly Metric[];
  /** Founder can edit (only while the startup is in Investor Readiness). */
  editable: boolean;
  next?: ReadinessNextAction | null;
  attentionSections?: readonly ReadinessSection[];
  attentionRequirementIds?: readonly string[];
}

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** The founder's Investor Readiness stage: completion, sections, requirements and materials. */
export function ReadinessView({
  startup,
  data,
  evidence,
  metrics,
  editable,
  next,
  attentionSections = [],
  attentionRequirementIds = [],
}: Props) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const completion = readinessCompletion(data.rows);
  const sections = sectionProgress(data.rows);
  const context: ReadinessContext = {
    startup,
    profile: data.profile,
    requirements: data.requirements,
    evidence,
    team: data.team,
    primaryMetricIds: data.primaryMetricIds,
  };

  const edit = (target: EditTarget) =>
    target.kind === 'startup_profile' ? void navigate(paths.founder.startup) : setEditing(target);

  const continueNext = () => {
    if (!next) return;
    if (next.intent === 'request' || next.intent === 'resubmit' || next.intent === 'pending') {
      scrollTo('readiness-review-title');
    } else if (next.intent === 'interview') {
      scrollTo('readiness-interview-title');
    } else if (next.intent === 'feedback' && attentionSections[0]) {
      scrollTo(`readiness-${attentionSections[0]}`);
    } else {
      const row = data.rows.find((r) => r.requirement_id === next.requirementId);
      if (row) {
        scrollTo(`readiness-req-${row.requirement_key}`);
        if (editable) edit(editTarget(row));
      }
    }
  };

  const editingRow = editing?.kind === 'requirement' ? editing.row : null;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="readiness-title"
        className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold tracking-[0.14em] text-subtle uppercase">
              Journey · Stage 05
            </p>
            <h2
              id="readiness-title"
              className="mt-1 text-[20px] font-semibold tracking-tight text-ink"
            >
              Investor Readiness
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              Prepare the story, numbers and materials an investor asks for.
            </p>
          </div>
          <Badge tone={editable ? 'blue' : 'neutral'}>
            {editable ? 'Current stage' : 'Earlier stage'}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12.5px] font-medium text-muted">Readiness completion</p>
            <p className="text-[15px] font-semibold text-ink">{completion.percent}% complete</p>
          </div>
          <StageProgressBar percent={completion.percent} label="Readiness completion" />
          <p className="text-[12.5px] text-muted">
            {completion.completed} of {completion.total} mandatory requirements complete
            {completion.missing > 0 && ` · ${completion.missing} missing`}
          </p>
        </div>
        {completion.isComplete ? (
          <div className="flex gap-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-success-strong"
              aria-hidden="true"
            />
            <p className="text-[13px] text-ink/80">
              <span className="font-semibold text-success-strong">
                Every mandatory requirement is complete.
              </span>{' '}
              {editable && 'Keep your materials current while innoWIUT reviews them.'}
            </p>
          </div>
        ) : null}
        {next && editable && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-canvas-subtle px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                Next action
              </p>
              <p className="mt-1 text-[13.5px] text-ink">{next.title}</p>
            </div>
            {next.intent !== 'pending' && next.intent !== 'access' && (
              <Button size="sm" onClick={continueNext}>
                Continue <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </section>

      <InterviewCard interview={data.interview} />

      <section aria-labelledby="readiness-sections-title" className="space-y-3">
        <h2 id="readiness-sections-title" className="text-[15px] font-semibold text-ink">
          Section progress
        </h2>
        <SectionProgressGrid sections={sections} />
      </section>

      <ReadinessSummaryCard context={context} metrics={metrics} />

      <ReadinessSections
        rows={data.rows}
        context={context}
        metrics={metrics}
        entries={data.entries}
        team={data.team}
        attentionSections={attentionSections}
        attentionRequirementIds={attentionRequirementIds}
        onEdit={editable ? edit : undefined}
      />

      {editable && (
        <>
          <RequirementEditDialog
            open={editingRow !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            startupId={startup.id}
            row={editingRow}
            requirement={data.requirements.find((r) => r.id === editingRow?.requirement_id) ?? null}
            evidence={evidence}
          />
          <ProfileSectionDialog
            open={editing?.kind === 'profile'}
            onOpenChange={(open) => !open && setEditing(null)}
            startupId={startup.id}
            group={editing?.kind === 'profile' ? (editing.group as ProfileGroup) : null}
            profile={data.profile}
          />
          <PrimaryMetricsDialog
            open={editing?.kind === 'metrics'}
            onOpenChange={(open) => !open && setEditing(null)}
            startupId={startup.id}
            selected={data.primaryMetricIds}
            metrics={metrics}
          />
        </>
      )}
    </div>
  );
}
