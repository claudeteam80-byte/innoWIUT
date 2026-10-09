import { Check, Lock } from 'lucide-react';
import {
  JOURNEY_STAGES,
  stagePosition,
  stageProgress,
  type StageKey,
  type StageRequirement,
} from '@/domain/journey';
import { cn } from '@/lib/cn';

const positionLabel = {
  completed: 'Earlier stage',
  current: 'Current stage',
  upcoming: 'Upcoming',
  locked: 'Locked',
} as const;

interface StageTrackerProps {
  current: StageKey;
  requirements: readonly StageRequirement[];
  selected?: StageKey;
  onSelect?: (stage: StageKey) => void;
}

/** The six innoWIUT stages. Investor stages are shown but locked. */
export function StageTracker({ current, requirements, selected, onSelect }: StageTrackerProps) {
  return (
    <ol
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
      aria-label="Journey stages"
    >
      {JOURNEY_STAGES.map((stage) => {
        const position = stagePosition(stage.key, current);
        const progress = stageProgress(stage.key, requirements);
        const isSelected = selected === stage.key;
        const content = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-subtle">
                {stage.number}
              </span>
              {position === 'locked' ? (
                <Lock className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
              ) : progress.isComplete ? (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-success text-white">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                'mt-2 text-[13.5px] leading-tight font-semibold',
                position === 'locked' ? 'text-subtle' : 'text-ink',
              )}
            >
              {stage.name}
            </p>
            <p
              className={cn(
                'mt-1 text-[10.5px] font-semibold tracking-[0.12em] uppercase',
                position === 'current' ? 'text-primary' : 'text-subtle',
              )}
            >
              {positionLabel[position]}
            </p>
            {!stage.locked && (
              <div
                className="mt-2.5 h-1 overflow-hidden rounded-full bg-primary-soft"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-success transition-[width]"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}
          </>
        );
        const base = cn(
          'block h-full w-full rounded-xl border px-3.5 py-3 text-left',
          position === 'current' ? 'border-primary/50 bg-white' : 'border-line bg-white',
          position === 'locked' && 'border-dashed bg-canvas-subtle',
          isSelected && 'ring-2 ring-primary/40',
        );
        return (
          <li key={stage.key}>
            {onSelect && !stage.locked ? (
              <button
                type="button"
                onClick={() => onSelect(stage.key)}
                aria-current={isSelected ? 'step' : undefined}
                aria-label={`${stage.name} — ${positionLabel[position]}, ${progress.completed} of ${progress.total} completed`}
                className={cn(base, 'transition hover:border-primary/50')}
              >
                {content}
              </button>
            ) : (
              <div
                className={base}
                aria-label={`${stage.name} — ${positionLabel[position]}`}
                aria-current={isSelected ? 'step' : undefined}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
