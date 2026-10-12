import { Link } from 'react-router';
import { ClipboardCheck } from 'lucide-react';
import { paths } from '@/app/paths';
import { ErrorState } from '@/components/shared/ErrorState';
import { buttonClasses } from '@/components/ui/button-styles';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/domain/format';
import { useReviewStats } from '../hooks';

/** Operational card on the admin dashboard: pending stage reviews (counted in Postgres). */
export function ReviewsWaitingCard() {
  const stats = useReviewStats();
  const pending = Number(stats.data?.pending_reviews ?? 0);
  const late = Number(stats.data?.waiting_over_3_days ?? 0);
  return (
    <section
      aria-labelledby="reviews-waiting"
      className="rounded-xl border border-line bg-white p-5 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          id="reviews-waiting"
          className="text-[10.5px] font-semibold tracking-[0.16em] text-muted uppercase"
        >
          Reviews waiting
        </h2>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {stats.isError ? (
        <ErrorState onRetry={() => void stats.refetch()} />
      ) : stats.isPending ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <>
          <p className="mt-1 text-[28px] font-semibold tracking-tight text-ink">
            {formatNumber(pending)}
          </p>
          <p
            className={
              late > 0 ? 'text-[12px] font-medium text-warning-strong' : 'text-[12px] text-subtle'
            }
          >
            {pending === 0 ? 'No stage reviews waiting' : `${late} waiting more than 3 days`}
          </p>
        </>
      )}
      <Link
        to={paths.admin.reviews}
        className={buttonClasses({ variant: 'outline', fullWidth: true, className: 'mt-4' })}
      >
        Open Review Queue
      </Link>
    </section>
  );
}
