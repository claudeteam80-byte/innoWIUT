import { Link, useParams, useSearchParams } from 'react-router';
import { useDocumentTitle } from '@/lib/document-title';
import { ArrowLeft, Building2, Globe } from 'lucide-react';
import { paths } from '@/app/paths';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { externalUrl } from '@/domain/contact';
import { formatRelativeDay } from '@/domain/dates';
import { publicFileUrl } from '@/lib/storage';
import { ActivityBadge } from '../components/ActivityBadge';
import {
  MentorTab,
  OverviewTab,
  TeamTab,
  TractionTab,
  UpdatesTab,
} from '../components/StartupTabs';
import { useAdminStartup, useStartupActivity } from '../hooks';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'traction', label: 'Traction' },
  { value: 'updates', label: 'Updates' },
  { value: 'team', label: 'Team' },
  { value: 'mentor', label: 'Mentor' },
] as const;
type Tab = (typeof TABS)[number]['value'];

export function AdminStartupDetailPage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'overview';
  const startup = useAdminStartup(id);
  const activity = useStartupActivity(id);
  useDocumentTitle(startup.data?.name ?? 'Startup');

  const back = (
    <Link
      to={paths.admin.startups}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Startups
    </Link>
  );

  if (startup.isError) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState onRetry={() => void startup.refetch()} />
      </div>
    );
  }
  if (startup.isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading startup">
        {back}
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!startup.data) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={Building2}
          title="Startup not found"
          description="This startup may have been removed."
        />
      </div>
    );
  }

  const data = startup.data;
  const website = externalUrl(data.website);
  const lastActive = activity.data?.last_active_on ?? null;

  return (
    <div className="space-y-6">
      {back}
      <header className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-start sm:p-6">
        <Avatar name={data.name} src={publicFileUrl('startup-logos', data.logo_path)} size="xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">{data.name}</h1>
            {activity.data && <ActivityBadge status={activity.data.activity_status} />}
          </div>
          {data.tagline && <p className="text-[14px] text-muted">{data.tagline}</p>}
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span>
              Founder{' '}
              <span className="font-medium text-ink">
                {data.owner?.full_name || data.owner?.email || '—'}
              </span>
            </span>
            {data.industry && <Badge tone="blue">{data.industry}</Badge>}
            {data.stage && <Badge tone="blue">{data.stage}</Badge>}
            <span>
              Last activity {lastActive ? formatRelativeDay(lastActive).toLowerCase() : '—'}
            </span>
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Website
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto">
        <Tabs
          label="Startup sections"
          value={tab}
          onChange={(next) =>
            setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true })
          }
          tabs={TABS}
        />
      </div>

      {tab === 'overview' && <OverviewTab startup={data} lastActive={lastActive} />}
      {tab === 'traction' && <TractionTab startupId={data.id} />}
      {tab === 'updates' && <UpdatesTab startupId={data.id} />}
      {tab === 'team' && <TeamTab startup={data} />}
      {tab === 'mentor' && <MentorTab startupId={data.id} startupName={data.name} />}
    </div>
  );
}
