import { ExternalLink, Pencil, Send, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/domain/dates';
import type { StartupUpdate } from '../api';
import { UpdateImage } from './UpdateImage';

interface UpdateCardProps {
  update: StartupUpdate;
  onEdit?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
  publishing?: boolean;
  compact?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      <div className="mt-1 text-[13.5px] leading-6 text-ink">{children}</div>
    </div>
  );
}

export function UpdateCard({
  update,
  onEdit,
  onPublish,
  onDelete,
  publishing,
  compact,
}: UpdateCardProps) {
  const isDraft = update.status === 'draft';
  return (
    <article className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-ink">{update.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {isDraft
              ? `Draft · last edited ${formatDate(update.updated_at)}`
              : `Published ${formatDate(update.update_date)}`}
          </p>
        </div>
        <Badge tone={isDraft ? 'warning' : 'positive'}>{isDraft ? 'Draft' : 'Published'}</Badge>
      </header>

      {update.summary && (
        <p className="whitespace-pre-line text-[14px] leading-6 text-ink">{update.summary}</p>
      )}

      {!compact && (
        <>
          {update.highlights.length > 0 && (
            <Section title="Highlights">
              <ul className="list-disc space-y-1 pl-5">
                {update.highlights.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </Section>
          )}
          {(update.challenge || update.next_steps) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {update.challenge && <Section title="Challenges">{update.challenge}</Section>}
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
