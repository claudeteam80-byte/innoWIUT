import { ExternalLink, Pencil, Send, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/domain/dates';
import { formatMetricValue } from '@/domain/format';
import { metricMovement, stageName, type StageEvidence } from '@/domain/journey';
import { describeMetricChange } from '@/domain/traction';
import { localToday } from '@/domain/form-fields';
import { EvidenceList } from '@/features/journey/components/EvidenceList';
import type { Entry, Metric } from '@/features/traction/api';
import { ChangePill } from '@/features/traction/components/ChangePill';
import type { StartupUpdate } from '../api';
import { UpdateImage } from './UpdateImage';

/** Evidence and traction history used to render an update's proof. Optional. */
export interface UpdateContext {
  evidence: readonly StageEvidence[];
  metrics: readonly Metric[];
  entries: readonly Entry[];
}

interface UpdateCardProps {
  update: StartupUpdate;
  context?: UpdateContext;
  onEdit?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
  publishing?: boolean;
  compact?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase">
        {title}
      </h4>
      <div className="mt-1 text-[13.5px] leading-6 text-ink">{children}</div>
    </div>
  );
}

/**
 * Renders both structured (V2.1) and V1 updates: structured fields when present, V1
 * highlights / challenges / next steps / image / link exactly as they were written.
 */
export function UpdateCard({
  update,
  context,
  onEdit,
  onPublish,
  onDelete,
  publishing,
  compact,
}: UpdateCardProps) {
  const isDraft = update.status === 'draft';
  const evidence = (context?.evidence ?? []).filter((item) => item.update_id === update.id);
  const proof = evidence.filter((item) => item.evidence_type !== 'metric');
  const movement = evidence.filter((item) => item.evidence_type === 'metric');
  // A published update shows the numbers as they were on its date; a draft shows today's.
  const asOf = isDraft ? localToday() : update.update_date;
  const hasPlan = Boolean(
    update.blocker || update.next_milestone || update.challenge || update.next_steps,
  );

  return (
    <article className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {update.progress_types.length > 0 && (
            <p className="mb-1 text-[10.5px] font-semibold tracking-[0.14em] text-primary uppercase">
              {update.progress_types.join(' · ')}
            </p>
          )}
          <h3 className="text-[16px] font-semibold text-ink">{update.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {isDraft
              ? `Draft · last edited ${formatDate(update.updated_at)}`
              : `Published ${formatDate(update.update_date)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {update.linked_stage && <Badge tone="blue">{stageName(update.linked_stage)}</Badge>}
          <Badge tone={isDraft ? 'warning' : 'positive'}>{isDraft ? 'Draft' : 'Published'}</Badge>
        </div>
      </header>

      {update.summary && (
        <p className="text-[14px] leading-6 whitespace-pre-line text-ink">{update.summary}</p>
      )}

      {!compact && (
        <>
          {proof.length > 0 && (
            <Section title="Evidence">
              <div className="mt-1.5">
                <EvidenceList items={proof} metrics={context?.metrics} />
              </div>
            </Section>
          )}
          {movement.length > 0 && (
            <Section title="Traction movement">
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {movement.map((item) => {
                  const metric = context?.metrics.find((m) => m.id === item.linked_metric_id);
                  if (!metric) {
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg bg-canvas px-2.5 py-1.5 text-[12.5px] text-muted"
                      >
                        {item.label} · no longer tracked
                      </li>
                    );
                  }
                  const move = metricMovement(context?.entries ?? [], metric.id, asOf);
                  const format = (value: number | null) =>
                    formatMetricValue(value, metric.unit, metric.currency);
                  return (
                    <li
                      key={item.id}
                      className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5 text-[12.5px] text-ink"
                    >
                      <span className="font-medium">{metric.name}</span>
                      <span className="text-muted">
                        {format(move.previous)} → {format(move.current)}
                      </span>
                      <ChangePill change={describeMetricChange(move.previous, move.current)} />
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
          {update.highlights.length > 0 && (
            <Section title="Highlights">
              <ul className="list-disc space-y-1 pl-5">
                {update.highlights.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </Section>
          )}
          {hasPlan && (
            <div className="grid gap-4 sm:grid-cols-2">
              {update.blocker && <Section title="Blocker">{update.blocker}</Section>}
              {update.challenge && <Section title="Challenges">{update.challenge}</Section>}
              {update.next_milestone && (
                <Section title="Next milestone">
                  {update.next_milestone}
                  {update.next_milestone_date && (
                    <span className="block text-[12px] text-muted">
                      Target: {formatDate(update.next_milestone_date)}
                    </span>
                  )}
                </Section>
              )}
              {update.next_steps && <Section title="Next steps">{update.next_steps}</Section>}
            </div>
          )}
          {update.image_path && (
            <UpdateImage path={update.image_path} alt={`Image for ${update.title}`} />
          )}
        </>
      )}

      {update.link_url && (
        <a
          href={update.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 truncate text-[13px] font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{update.link_url.replace(/^https?:\/\//, '')}</span>
        </a>
      )}

      {isDraft && (onEdit || onPublish || onDelete) && (
        <footer className="flex flex-wrap gap-2 border-t border-line pt-4">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil aria-hidden="true" /> Edit draft
            </Button>
          )}
          {onPublish && (
            <Button size="sm" onClick={onPublish} loading={publishing}>
              <Send aria-hidden="true" /> Publish
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="sm:ml-auto">
              <Trash2 aria-hidden="true" /> Delete draft
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
