import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { ErrorState } from '@/components/shared/ErrorState';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/domain/format';
import { JOURNEY_STAGES } from '@/domain/journey';
import { useStageDistribution } from '../hooks';

const OPEN_STAGES = JOURNEY_STAGES.filter((stage) => !stage.locked);

/** Onboarded startups per journey stage (counted in Postgres). */
export function StageDistribution() {
  const distribution = useStageDistribution();
  const counts = Object.fromEntries(
    (distribution.data ?? []).map((row) => [row.stage, Number(row.startups)]),
  );
  const total = OPEN_STAGES.reduce((sum, stage) => sum + (counts[stage.key] ?? 0), 0);

  return (
    <Card>
      <CardHeader
        title="Stage Distribution"
        description="Where startups sit in the innoWIUT journey."
      />
      {distribution.isError ? (
        <ErrorState onRetry={() => void distribution.refetch()} />
      ) : distribution.isPending ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading stage distribution">
          {OPEN_STAGES.map((stage) => (
            <Skeleton key={stage.key} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Startups per stage">
          {OPEN_STAGES.map((stage) => {
            const count = counts[stage.key] ?? 0;
            const percent = total ? Math.round((count / total) * 100) : 0;
            return (
              <li key={stage.key}>
                <Link
                  to={`${paths.admin.startups}?stage=${stage.key}`}
                  className="block rounded-lg px-1 py-0.5 hover:bg-canvas"
                  aria-label={`${stage.name}: ${count} ${count === 1 ? 'startup' : 'startups'}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium text-ink">
                      <span className="text-subtle">{stage.number} · </span>
                      {stage.name}
                    </span>
                    <span className="text-muted">
                      <span className="font-semibold text-ink">{formatNumber(count)}</span> ·{' '}
                      {percent}%
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary-soft"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-[12px] text-subtle">
        Investor Readiness and Investor Access are locked in this version.
      </p>
    </Card>
  );
}
