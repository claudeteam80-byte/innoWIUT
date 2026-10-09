import { Link, useNavigate } from 'react-router';
import { Activity, ArrowRight, FileText, Moon, TrendingUp } from 'lucide-react';
import { paths } from '@/app/paths';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/domain/dates';
import { publicFileUrl } from '@/lib/storage';
import { StageDistribution } from '../components/StageDistribution';
import { StatCard } from '../components/StatCard';
import { useDashboardStats, useRecentUpdates } from '../hooks';

export function AdminDashboardPage() {
  const stats = useDashboardStats();
  const recent = useRecentUpdates();
  const navigate = useNavigate();
  const total = stats.data?.total_startups ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="innoWIUT"
        title="innoWIUT Startup Dashboard"
        subtitle="Monitor startup activity and traction across the ecosystem."
      />

      {stats.isError ? (
        <ErrorState
          description="We couldn't load the ecosystem stats."
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <section aria-label="Ecosystem stats" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Startups"
            value={stats.data?.active_startups}
            meta={`Activity in the last 7 days · ${total} onboarded in total`}
            icon={Activity}
            loading={stats.isPending}
          />
          <StatCard
            label="Updates This Week"
            value={stats.data?.updates_this_week}
            meta="Published founder updates, last 7 days"
            icon={FileText}
            loading={stats.isPending}
          />
          <StatCard
            label="Startups with Traction Growth"
            value={stats.data?.growing_startups}
            meta="Latest value above the previous one"
            icon={TrendingUp}
            loading={stats.isPending}
          />
          <StatCard
            label="Inactive Startups"
            value={stats.data?.inactive_startups}
            meta={`No activity for 15+ days · ${stats.data?.needs_update_startups ?? 0} need an update`}
            icon={Moon}
            loading={stats.isPending}
          />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <StageDistribution />
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent founder updates"
            description="The latest published progress from founders."
            action={
              <Link
                to={paths.admin.startups}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
              >
                All startups <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            }
          />
          {recent.isError ? (
            <ErrorState onRetry={() => void recent.refetch()} />
          ) : recent.isPending ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading updates">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : recent.data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No recent founder updates"
              description="Published founder updates will appear here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {recent.data.map((update) => (
                <li key={update.id}>
                  <button
                    type="button"
                    onClick={() =>
                      update.startup &&
                      navigate(`${paths.admin.startupDetail(update.startup.id)}?tab=updates`)
                    }
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-canvas"
                  >
                    <Avatar
                      name={update.startup?.name ?? '?'}
                      src={publicFileUrl('startup-logos', update.startup?.logo_path)}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="truncate text-[13.5px] font-semibold text-ink">
                          {update.title}
                        </p>
                        <span className="shrink-0 text-[12px] text-subtle">
                          {formatDate(update.published_at ?? update.update_date)}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-muted">
                        {update.startup?.name ?? 'Unknown startup'} ·{' '}
                        {update.startup?.owner?.full_name || 'Founder'}
                      </p>
                      {update.summary && (
                        <p className="mt-1 line-clamp-2 text-[13px] text-ink/80">
                          {update.summary}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
