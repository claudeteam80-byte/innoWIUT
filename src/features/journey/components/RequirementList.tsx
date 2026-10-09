import { Link } from 'react-router';
import { Link2, Paperclip, Pencil, Plus } from 'lucide-react';
import { paths } from '@/app/paths';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatMetricValue } from '@/domain/format';
import {
  REQUIREMENT_STATUSES,
  evidenceFor,
  templateFor,
  type StageEvidence,
  type StageRequirement,
} from '@/domain/journey';
import type { Metric } from '@/features/traction/api';
import { formatNumber } from '@/domain/format';

export function StatusBadge({ status }: { status: StageRequirement['status'] }) {
  const meta = REQUIREMENT_STATUSES.find((s) => s.value === status) ?? REQUIREMENT_STATUSES[0]!;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

interface RequirementListProps {
  rows: readonly StageRequirement[];
  evidence: readonly StageEvidence[];
  metrics: readonly Metric[];
  /** Founder actions; omit for read-only (admin). */
  onUpdate?: (row: StageRequirement) => void;
  onAddEvidence?: (row: StageRequirement) => void;
  highlightId?: string | null;
}

export function RequirementList({
  rows,
  evidence,
  metrics,
  onUpdate,
  onAddEvidence,
  highlightId,
}: RequirementListProps) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const template = templateFor(row);
        const items = evidenceFor(row.id, evidence);
        const metric = metrics.find((m) => m.id === row.linked_metric_id);
        const isTraction = row.stage === 'traction';
        return (
          <li
            key={row.id}
            id={`requirement-${row.id}`}
            className={
              highlightId === row.id
                ? '-mx-2 rounded-lg bg-primary-soft/50 px-2 py-4'
                : 'py-4 first:pt-0 last:pb-0'
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-ink">{row.title}</h3>
                  <StatusBadge status={row.status} />
                </div>
                {(template?.hint || row.description) && (
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {template?.hint ?? row.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
                  {row.progress_target !== null && (
                    <span>
                      <span className="font-semibold text-ink">
                        {formatNumber(row.progress_value ?? 0)}
                      </span>{' '}
                      / {formatNumber(row.progress_target)} {template?.targetLabel ?? ''}
                    </span>
                  )}
                  {isTraction &&
                    (metric ? (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {metric.name}:{' '}
                        <span className="font-semibold text-ink">
                          {formatMetricValue(metric.current_value, metric.unit, metric.currency)}
                        </span>
                      </span>
                    ) : (
                      <span>No traction metric linked</span>
                    ))}
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                    {items.length} evidence {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>
              {(onUpdate || onAddEvidence) && (
                <div className="flex shrink-0 gap-2">
                  {onUpdate && (
                    <Button variant="outline" size="sm" onClick={() => onUpdate(row)}>
                      <Pencil aria-hidden="true" /> Update
                    </Button>
                  )}
                  {onAddEvidence && (
                    <Button variant="outline" size="sm" onClick={() => onAddEvidence(row)}>
                      <Plus aria-hidden="true" /> Add Evidence
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isTraction && metric && onUpdate && (
              <Link
                to={paths.founder.traction}
                className="mt-2 inline-block text-[12.5px] font-medium text-primary hover:underline"
              >
                Record new {metric.name} value
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
