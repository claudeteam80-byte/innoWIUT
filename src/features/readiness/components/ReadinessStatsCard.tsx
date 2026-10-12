import { Link } from 'react-router';
import { Rocket } from 'lucide-react';
import { paths } from '@/app/paths';
import { ErrorState } from '@/components/shared/ErrorState';
import { buttonClasses } from '@/components/ui/button-styles';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/domain/format';
import { useReadinessStats } from '../hooks';

/** Admin dashboard: Investor Readiness at a glance (counted in Postgres). */
export function ReadinessStatsCard() {
  const stats = useReadinessStats();
  const rows = [
    {
      label: 'Startups in Investor Readiness',
      value: stats.data?.startups_in_readiness,
      to: `${paths.admin.startups}?stage=investor_readiness`,
    },
    {
      label: 'Pending Readiness Reviews',
      value: stats.data?.pending_readiness_reviews,
      to: `${paths.admin.reviews}?type=investor_readiness`,
    },
    {
      label: 'Investor Ready Startups',
      value: stats.data?.investor_ready_startups,
      to: `${paths.admin.startups}?stage=investor_access`,
    },
  ];
  return (
    <section
      aria-labelledby="readiness-stats"
      className="rounded-xl border border-line bg-white p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="readiness-stats"
          className="text-[10.5px] font-semibold tracking-[0.16em] text-muted uppercase"
        >
          Investor Readiness
        </h2>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
          <Rocket className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {stats.isError ? (
        <ErrorState onRetry={() => void stats.refetch()} />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {rows.map((row) => (
            <li key={row.label}>
              <Link
                to={row.to}
                className="flex items-center justify-between gap-3 py-2.5 text-[13px] hover:text-primary"
              >
                <span className="text-muted">{row.label}</span>
                {stats.isPending ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <span className="text-[16px] font-semibold text-ink">
                    {formatNumber(Number(row.value ?? 0))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`${paths.admin.reviews}?type=investor_readiness`}
        className={buttonClasses({ variant: 'outline', fullWidth: true, className: 'mt-3' })}
      >
        Readiness Reviews
      </Link>
    </section>
  );
}
