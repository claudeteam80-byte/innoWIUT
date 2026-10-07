import { useState } from 'react';
import { useDocumentTitle } from '@/lib/document-title';
import { Link } from 'react-router';
import { ArrowRight, FileText, Globe, Plus, RefreshCw, Target, UserRound } from 'lucide-react';
import { paths } from '@/app/paths';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { externalUrl } from '@/domain/contact';
import { greetingFor } from '@/domain/greeting';
import { useAuth } from '@/features/auth/useAuth';
import { useAssignedMentor } from '@/features/mentor/hooks';
import type { Startup } from '@/features/startup/api';
import { useMyStartup } from '@/features/startup/hooks';
import { AddMetricDialog } from '@/features/traction/components/AddMetricDialog';
import { MetricCard } from '@/features/traction/components/MetricCard';
import { sortByRecent } from '@/features/traction/utils';
import { RecordTractionDialog } from '@/features/traction/components/RecordTractionDialog';
import { ChartSkeleton, MetricCardsSkeleton } from '@/features/traction/components/Skeletons';
import { TractionChart } from '@/features/traction/components/TractionChart';
import { TractionEmptyState } from '@/features/traction/components/TractionEmptyState';
import { useEntries, useMetrics } from '@/features/traction/hooks';
import { UpdateCard } from '@/features/updates/components/UpdateCard';
import { UpdateDialog } from '@/features/updates/components/UpdateDialog';
import { useUpdates } from '@/features/updates/hooks';
import { firstName } from '@/lib/text';
import { publicFileUrl } from '@/lib/storage';

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { profile } = useAuth();
  const startup = useMyStartup();
  const startupId = startup.data?.id;
  const metrics = useMetrics(startupId);
  const entries = useEntries(startupId);
  const updates = useUpdates(startupId);
  const mentor = useAssignedMentor(startupId);
  const [dialog, setDialog] = useState<'update' | 'traction' | 'metric' | null>(null);

  const name = firstName(profile?.full_name);
  const metricList = metrics.data ?? [];
  const latestPublished = (updates.data ?? []).find((u) => u.status === 'published') ?? null;

  if (startup.isError) return <ErrorState onRetry={() => void startup.refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
            {startup.data?.name ?? '\u00a0'}
          </p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-ink">
            {greetingFor()}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Here&apos;s what&apos;s happening with your startup.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" onClick={() => setDialog('update')} disabled={!startupId}>
            <FileText aria-hidden="true" /> Add Update
          </Button>
          <Button
            onClick={() => setDialog(metricList.length ? 'traction' : 'metric')}
            disabled={!startupId || metrics.isPending}
          >
            <RefreshCw aria-hidden="true" /> Update Traction
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {startup.isPending ? (
            <Skeleton className="h-36 w-full rounded-xl" />
          ) : (
            <StartupSummary startup={startup.data} />
          )}

          <section aria-labelledby="traction-overview" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="traction-overview" className="text-[15px] font-semibold text-ink">
                Traction overview
              </h2>
              {metricList.length > 0 && (
                <Link
                  to={paths.founder.traction}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                >
                  View all traction <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
            {metrics.isError ? (
              <ErrorState onRetry={() => void metrics.refetch()} />
            ) : metrics.isPending ? (
              <MetricCardsSkeleton />
            ) : metricList.length === 0 ? (
              <TractionEmptyState onAddMetric={() => setDialog('metric')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sortByRecent(metricList)
                  .slice(0, 4)
                  .map((metric) => (
                    <MetricCard key={metric.id} metric={metric} />
                  ))}
              </div>
            )}
          </section>

          {metricList.length > 0 && (
            <Card>
              <CardHeader title="Traction trend" description="From your recorded history." />
              {entries.isError ? (
                <ErrorState onRetry={() => void entries.refetch()} />
              ) : entries.isPending ? (
                <ChartSkeleton />
              ) : (
                <TractionChart metrics={metricList} entries={entries.data} />
              )}
            </Card>
          )}

          <section aria-labelledby="latest-update" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="latest-update" className="text-[15px] font-semibold text-ink">
                Latest update
              </h2>
              <Link
                to={paths.founder.updates}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
              >
                View all updates <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            {updates.isError ? (
              <ErrorState onRetry={() => void updates.refetch()} />
            ) : updates.isPending ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : latestPublished ? (
              <UpdateCard update={latestPublished} compact />
            ) : (
              <EmptyState
                icon={FileText}
                title="No updates yet"
                description="Share your first progress update with innoWIUT."
                action={
                  <Button onClick={() => setDialog('update')}>
                    <Plus aria-hidden="true" /> Create Update
                  </Button>
                }
              />
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Current goal" />
            {startup.isPending ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-[13.5px] leading-6 text-ink">
                    {startup.data.main_goal || 'No goal set yet.'}
                  </p>
                </div>
                {startup.data.biggest_challenge && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                      Biggest challenge
                    </p>
                    <p className="mt-1 text-[13px] leading-6 text-muted">
                      {startup.data.biggest_challenge}
                    </p>
                  </div>
                )}
                <Link
                  to={paths.founder.startup}
                  className="text-[12.5px] font-medium text-primary hover:underline"
                >
                  Edit goals
                </Link>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Mentor" />
            {mentor.isError ? (
              <ErrorState onRetry={() => void mentor.refetch()} />
            ) : mentor.isPending ? (
              <Skeleton className="h-14 w-full" />
            ) : mentor.data ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={mentor.data.name}
                    src={publicFileUrl('mentor-photos', mentor.data.photo_path)}
                    shape="circle"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {mentor.data.name}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">
                      {mentor.data.expertise.join(' · ') || mentor.data.title || 'innoWIUT Mentor'}
                    </p>
                  </div>
                </div>
                <Link
                  to={paths.founder.mentor}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                >
                  View mentor <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[13px] text-muted">
                <UserRound className="h-5 w-5 text-subtle" aria-hidden="true" />
                No mentor assigned yet.
              </div>
            )}
          </Card>
        </div>
      </div>

      {startupId && (
        <>
          <UpdateDialog
            open={dialog === 'update'}
            onOpenChange={(open) => !open && setDialog(null)}
            startupId={startupId}
          />
          <RecordTractionDialog
            open={dialog === 'traction'}
            onOpenChange={(open) => !open && setDialog(null)}
            startupId={startupId}
            metrics={metricList}
          />
          <AddMetricDialog
            open={dialog === 'metric'}
            onOpenChange={(open) => !open && setDialog(null)}
            startupId={startupId}
            existingNames={metricList.map((m) => m.name)}
          />
        </>
      )}
    </div>
  );
}

function StartupSummary({ startup }: { startup: Startup }) {
  const website = externalUrl(startup.website);
  const facts = [
    startup.industry,
    startup.stage,
    startup.team_size
      ? `${startup.team_size} ${startup.team_size === 1 ? 'person' : 'people'}`
      : null,
  ].filter(Boolean) as string[];
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
      <Avatar
        name={startup.name}
        src={publicFileUrl('startup-logos', startup.logo_path)}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-[18px] font-semibold text-ink">{startup.name}</h2>
        {startup.tagline && <p className="mt-0.5 text-[13.5px] text-muted">{startup.tagline}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {facts.map((fact) => (
            <Badge key={fact} tone="blue">
              {fact}
            </Badge>
          ))}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          )}
        </div>
      </div>
      <Link
        to={paths.founder.startup}
        className="text-[13px] font-medium text-primary hover:underline sm:self-start"
      >
        Edit profile
      </Link>
    </section>
  );
}
