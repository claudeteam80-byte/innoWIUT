import { Link } from 'react-router';
import { ArrowUpRight, Pencil } from 'lucide-react';
import { paths } from '@/app/paths';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  COMMITMENTS,
  optionLabel,
  sectionProgress,
  type ReadinessSection,
  type ReadinessStateRow,
  type SectionStatus,
} from '@/domain/readiness';
import type { Entry, Metric } from '@/features/traction/api';
import type { Tables } from '@/types/database';
import { editTarget, type EditTarget } from '../ui-helpers';
import { requirementSource, requirementValue, type ReadinessContext } from '../values';
import { PrimaryMetricsTable } from './PrimaryMetrics';

const SECTION_STATUS: Record<
  SectionStatus,
  { label: string; tone: 'positive' | 'blue' | 'neutral' }
> = {
  complete: { label: 'Complete', tone: 'positive' },
  in_progress: { label: 'In progress', tone: 'blue' },
  not_started: { label: 'Not started', tone: 'neutral' },
};

function RowStatus({ row }: { row: ReadinessStateRow }) {
  if (row.not_applicable) return <Badge>Not applicable</Badge>;
  if (row.is_complete) return <Badge tone="positive">Complete</Badge>;
  if (!row.required) return <Badge>Optional</Badge>;
  return <Badge tone="warning">Missing</Badge>;
}

interface Props {
  rows: readonly ReadinessStateRow[];
  context: ReadinessContext;
  metrics: readonly Metric[];
  entries: readonly Entry[];
  team: readonly Tables<'team_members'>[];
  /** Flagged by the latest Needs Work decision. */
  attentionSections?: readonly ReadinessSection[];
  attentionRequirementIds?: readonly string[];
  /** Founder edit handler; omit for read-only (admin, or after the stage). */
  onEdit?: (target: EditTarget) => void;
  /** Number of the first section heading (admin review numbering). */
  startNumber?: number;
}

/** The nine readiness sections with their requirements, values and status. */
export function ReadinessSections({
  rows,
  context,
  metrics,
  entries,
  team,
  attentionSections = [],
  attentionRequirementIds = [],
  onEdit,
  startNumber,
}: Props) {
  return (
    <div className="space-y-4">
      {sectionProgress(rows).map((section, index) => {
        const meta = SECTION_STATUS[section.status];
        const flagged = attentionSections.includes(section.key);
        return (
          <Card key={section.key} id={`readiness-${section.key}`} className="scroll-mt-6">
            <CardHeader
              title={startNumber ? `${startNumber + index}. ${section.name}` : section.name}
              description={`${section.completed} of ${section.total} required complete`}
              action={
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {flagged && <Badge tone="danger">Needs attention</Badge>}
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
              }
            />
            <ul className="divide-y divide-line">
              {section.rows.map((row) => {
                const value = requirementValue(row, context);
                const source = requirementSource(row);
                const own = context.requirements.find((r) => r.id === row.requirement_id);
                const target = editTarget(row);
                return (
                  <li
                    key={row.requirement_id}
                    id={`readiness-req-${row.requirement_key}`}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[13.5px] font-semibold text-ink">{row.title}</h3>
                        <RowStatus row={row} />
                        {attentionRequirementIds.includes(row.requirement_id) && (
                          <Badge tone="danger">Needs attention</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-muted">{source ?? row.description}</p>
                      {row.not_applicable ? (
                        <p className="mt-1 text-[12.5px] text-muted">
                          {own?.not_applicable_reason
                            ? `Not applicable — ${own.not_applicable_reason}`
                            : 'Not applicable to this round.'}
                        </p>
                      ) : value ? (
                        <p className="mt-1 line-clamp-3 text-[13px] leading-5 break-words whitespace-pre-line text-ink">
                          {value}
                        </p>
                      ) : null}
                    </div>
                    {onEdit &&
                      (target.kind === 'startup_profile' ? (
                        <Link
                          to={paths.founder.startup}
                          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-primary hover:underline"
                        >
                          Startup profile{' '}
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Update ${row.title}`}
                          onClick={() => onEdit(target)}
                        >
                          <Pencil aria-hidden="true" /> Update
                        </Button>
                      ))}
                  </li>
                );
              })}
            </ul>
            {section.key === 'traction' && (
              <div className="mt-4">
                {context.primaryMetricIds.length > 0 ? (
                  <PrimaryMetricsTable
                    metricIds={context.primaryMetricIds}
                    metrics={metrics}
                    entries={entries}
                  />
                ) : (
                  <p className="text-[12.5px] text-muted">No primary investor metrics selected.</p>
                )}
              </div>
            )}
            {section.key === 'team' && team.length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {team.map((member) => (
                  <li
                    key={member.id}
                    className="rounded-lg border border-line bg-canvas-subtle px-3.5 py-2.5"
                  >
                    <p className="text-[13px] font-medium text-ink">
                      {member.name}
                      {member.role && (
                        <span className="font-normal text-muted"> · {member.role}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {optionLabel(COMMITMENTS, member.commitment) ?? 'Commitment not set'}
                      {' · '}
                      {member.relevant_experience?.trim() ? (
                        <span className="text-ink">{member.relevant_experience}</span>
                      ) : (
                        'Experience not added'
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
