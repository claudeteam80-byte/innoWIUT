import type { ReactNode } from 'react';
import { CheckCircle2, Compass } from 'lucide-react';
import { progressText, type journeySummary } from '@/domain/journey';
import type { ReviewState, ReviewType } from '@/domain/reviews';
import { ReviewStatusPill } from '@/features/reviews/components/ReviewStatusPill';
import { cn } from '@/lib/cn';

type Summary = ReturnType<typeof journeySummary>;

export function StageProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-primary-soft"
    >
      <div
        className="h-full rounded-full bg-success transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Current stage, progress and the next required action. Completing the stage only shows
 * "Stage requirements completed" — the stage itself never changes here.
 */
export function CurrentStageCard({
  summary,
  action,
  className,
  reviewState,
  reviewType = 'stage',
  pillType,
}: {
  summary: Summary;
  action?: ReactNode;
  className?: string;
  /** Review status of the current stage (omitted where a stage cannot be reviewed). */
  reviewState?: ReviewState;
  reviewType?: ReviewType;
  /** Type of the review the status pill is about (e.g. the Traction approval), if different. */
  pillType?: ReviewType;
}) {
  const access = summary.stage.key === 'investor_access';
  const readiness = reviewType === 'investor_readiness' && !access;
  return (
    <section
      aria-labelledby="current-stage-title"
      className={cn(
        'rounded-xl border border-primary/25 bg-white p-5 shadow-card sm:p-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold tracking-[0.16em] text-primary uppercase">
            Current stage
          </p>
          <h2
            id="current-stage-title"
            className="mt-1.5 text-[20px] font-semibold tracking-tight text-ink"
          >
            <span className="text-subtle">{summary.stage.number} · </span>
            {summary.stage.name}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{summary.stage.purpose}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {!access && (
            <p className="text-[22px] font-semibold text-primary" aria-hidden="true">
              {summary.percent}%{readiness && <span className="text-[13px]"> complete</span>}
            </p>
          )}
          {reviewState && <ReviewStatusPill state={reviewState} type={pillType ?? reviewType} />}
        </div>
      </div>
      {access ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-success-strong">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Investor Ready · Investor Access
          unlocked
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <StageProgressBar
            percent={summary.percent}
            label={readiness ? 'Readiness completion' : `${summary.stage.name} progress`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
            <span className="text-muted">
              {readiness
                ? `Readiness completion · ${summary.completed} of ${summary.total} mandatory requirements${summary.total > summary.completed ? ` · ${summary.total - summary.completed} missing` : ''}`
                : progressText(summary)}
            </span>
            {summary.isComplete && (
              <span className="inline-flex items-center gap-1 font-medium text-success-strong">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{' '}
                {readiness ? 'Readiness requirements completed' : 'Stage requirements completed'}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="mt-4 rounded-lg bg-canvas-subtle px-4 py-3">
        <p className="text-[10.5px] font-semibold tracking-[0.14em] text-muted uppercase">
          {access ? 'Next' : 'Next required action'}
        </p>
        <p className="mt-1 text-[13.5px] leading-6 text-ink">{summary.next.title}</p>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

export function NextBestActionCard({ summary, action }: { summary: Summary; action?: ReactNode }) {
  return (
    <section
      aria-labelledby="next-best-action"
      className="rounded-xl border border-line bg-white p-5 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Compass className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id="next-best-action"
            className="text-[10.5px] font-semibold tracking-[0.16em] text-muted uppercase"
          >
            Next best action
          </h2>
          <p className="mt-1.5 text-[14.5px] leading-snug font-semibold text-ink">
            {summary.next.title}
          </p>
          <p className="mt-1 text-[12.5px] text-muted">
            {summary.stage.name} ·{' '}
            {summary.stage.key === 'investor_access'
              ? 'Investor Ready'
              : summary.stage.key === 'investor_readiness'
                ? `${summary.percent}% complete · ${summary.total - summary.completed} missing`
                : `stage · ${progressText(summary)}`}
          </p>
        </div>
      </div>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
