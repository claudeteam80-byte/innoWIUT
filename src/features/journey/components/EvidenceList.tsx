import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/domain/dates';
import { formatMetricValue } from '@/domain/format';
import { evidenceTypeLabel, type StageEvidence } from '@/domain/journey';
import type { Metric } from '@/features/traction/api';
import { UpdateImage } from '@/features/updates/components/UpdateImage';
import { useSignedImageUrl } from '@/features/updates/hooks';

function FileLink({ path, label }: { path: string; label: string }) {
  const signed = useSignedImageUrl(path);
  if (!signed.data) {
    return (
      <span className="text-[12.5px] text-muted">
        {signed.isError ? 'File unavailable' : 'Loading file…'}
      </span>
    );
  }
  return (
    <a
      href={signed.data}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
    >
      <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Open {label}
    </a>
  );
}

const isImagePath = (path: string) => /\.(png|jpe?g|webp)$/i.test(path);

interface EvidenceListProps {
  items: readonly StageEvidence[];
  metrics?: readonly Metric[];
  /** Requirement titles by id, shown on each card. */
  requirementTitles?: Record<string, string>;
  onDelete?: (item: StageEvidence) => void;
  deletingId?: string | null;
}

/** Structured proof. Metric evidence shows the live value from traction — never a copy. */
export function EvidenceList({
  items,
  metrics = [],
  requirementTitles,
  onDelete,
  deletingId,
}: EvidenceListProps) {
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {items.map((item) => {
        const metric = metrics.find((m) => m.id === item.linked_metric_id);
        const requirement = item.requirement_id ? requirementTitles?.[item.requirement_id] : null;
        return (
          <li
            key={item.id}
            className="flex flex-col rounded-lg border border-line bg-canvas-subtle px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                {evidenceTypeLabel(item.evidence_type)}
              </p>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-mt-1.5 -mr-2 h-7 px-2"
                  aria-label={`Remove evidence ${item.label}`}
                  loading={deletingId === item.id}
                  onClick={() => onDelete(item)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-snug font-medium break-words text-ink">
              {item.label}
            </p>
            {item.text_value && (
              <p className="mt-1 text-[12.5px] leading-relaxed whitespace-pre-line text-muted">
                {item.text_value}
              </p>
            )}
            {item.evidence_type === 'metric' && (
              <p className="mt-1 text-[12.5px] text-muted">
                {metric
                  ? `${metric.name}: ${formatMetricValue(metric.current_value, metric.unit, metric.currency)}`
                  : 'Metric no longer tracked'}
              </p>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-[12.5px] font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.url.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {item.file_path &&
              (item.evidence_type === 'screenshot' && isImagePath(item.file_path) ? (
                <div className="mt-2">
                  <UpdateImage path={item.file_path} alt={item.label} />
                </div>
              ) : (
                <div className="mt-1.5">
                  <FileLink
                    path={item.file_path}
                    label={item.evidence_type === 'screenshot' ? 'screenshot' : 'document'}
                  />
                </div>
              ))}
            <p className="mt-auto pt-2 text-[11.5px] text-subtle">
              {formatDate(item.created_at)}
              {requirement ? ` · ${requirement}` : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
