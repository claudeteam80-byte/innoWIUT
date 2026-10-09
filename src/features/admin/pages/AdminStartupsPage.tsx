import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Building2, Search } from 'lucide-react';
import { paths } from '@/app/paths';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { inputClasses } from '@/components/ui/TextField';
import { ACTIVITY_FILTERS } from '@/domain/activity';
import { formatRelativeDay } from '@/domain/dates';
import { formatMetricValue } from '@/domain/format';
import { INDUSTRIES } from '@/domain/options';
import { JOURNEY_STAGES, stageName } from '@/domain/journey';
import { describeMetricChange } from '@/domain/traction';
import { ChangePill } from '@/features/traction/components/ChangePill';
import { cn } from '@/lib/cn';
import { publicFileUrl } from '@/lib/storage';
import { STARTUP_PAGE_SIZE, type StartupListParams, type StartupListRow } from '../api';
import { ActivityBadge } from '../components/ActivityBadge';
import { Pagination } from '../components/Pagination';
import { useStartupList } from '../hooks';
import { paramsFromSearch, searchFromParams, STARTUP_SORTS } from '../startup-params';

export function AdminStartupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = paramsFromSearch(searchParams);
  const [searchText, setSearchText] = useState(params.search);
  const list = useStartupList(params);

  const update = (patch: Partial<StartupListParams>) =>
    setSearchParams(searchFromParams({ ...params, page: 1, ...patch }), { replace: true });

  // Debounce typing before querying the database.
  useEffect(() => {
    if (searchText === params.search) return;
    const timer = window.setTimeout(() => update({ search: searchText }), 300);
    return () => window.clearTimeout(timer);
  });

  const filtered = Boolean(
    params.search || params.stage || params.industry || params.activity || params.mentor,
  );
  const rows = list.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="innoWIUT"
        title="Startups"
        subtitle="Search, filter and open any startup in the ecosystem."
      />

      <section
        aria-label="Filters"
        className="grid gap-3 rounded-xl border border-line bg-white p-4 shadow-card md:grid-cols-2 xl:grid-cols-6"
      >
        <div className="relative md:col-span-2">
          <label htmlFor="startup-search" className="mb-1.5 block text-[13px] font-medium text-ink">
            Search
          </label>
          <Search
            className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-subtle"
            aria-hidden="true"
          />
          <input
            id="startup-search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Startup or founder name"
            className={cn(inputClasses, 'pl-9')}
          />
        </div>
        <SelectField
          label="Stage"
          value={params.stage}
          onChange={(e) => update({ stage: e.target.value })}
          placeholder="All stages"
          options={JOURNEY_STAGES.filter((stage) => !stage.locked).map((stage) => ({
            value: stage.key,
            label: stage.name,
          }))}
        />
        <SelectField
          label="Industry"
          value={params.industry}
          onChange={(e) => update({ industry: e.target.value })}
          placeholder="All industries"
          options={INDUSTRIES}
        />
        <SelectField
          label="Activity"
          value={params.activity}
          onChange={(e) => update({ activity: e.target.value })}
          placeholder="All activity"
          options={ACTIVITY_FILTERS}
        />
        <SelectField
          label="Mentor"
          value={params.mentor}
          onChange={(e) => update({ mentor: e.target.value })}
          placeholder="Any"
          options={[
            { value: 'assigned', label: 'Mentor assigned' },
            { value: 'unassigned', label: 'No mentor' },
          ]}
        />
        <SelectField
          label="Sort"
          value={params.sort}
          onChange={(e) => update({ sort: e.target.value as StartupListParams['sort'] })}
          options={STARTUP_SORTS}
          className="md:col-span-2 xl:col-span-1"
        />
        {filtered && (
          <div className="flex items-end md:col-span-2 xl:col-span-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchText('');
                setSearchParams(new URLSearchParams(), { replace: true });
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>

      {list.isError ? (
        <ErrorState description="We couldn't load startups." onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading startups">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? 'No startups match these filters' : 'No startups yet'}
          description={
            filtered
              ? 'Try a different search, stage, industry, activity or mentor filter.'
              : 'Startups appear here once founders complete onboarding.'
          }
        />
      ) : (
        <div className={cn('space-y-4 transition-opacity', list.isPlaceholderData && 'opacity-60')}>
          <StartupTable rows={rows} />
          <StartupCards rows={rows} />
          <Pagination
            label="Startups"
            page={params.page}
            pageSize={STARTUP_PAGE_SIZE}
            total={list.data.total}
            onPageChange={(page) => setSearchParams(searchFromParams({ ...params, page }))}
          />
        </div>
      )}
    </div>
  );
}

function metricValue(row: StartupListRow) {
  if (!row.primary_metric_name || !row.primary_metric_unit) return '—';
  return formatMetricValue(
    row.primary_metric_value,
    row.primary_metric_unit,
    row.primary_metric_currency,
  );
}

function StartupTable({ rows }: { rows: StartupListRow[] }) {
  const cell = 'px-3 py-3 align-middle group-hover:bg-canvas-subtle';
  const header =
    'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted whitespace-nowrap';
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-line bg-white shadow-card lg:block">
      <table className="w-full table-fixed text-[12.5px]">
        <caption className="sr-only">Startups</caption>
        <colgroup>
          <col className="w-[27%]" />
          <col className="w-[15%]" />
          <col className="w-[21%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead className="border-b border-line bg-canvas-subtle">
          <tr>
            <th scope="col" className={header}>
              Startup
            </th>
            <th scope="col" className={header}>
              Sector · Stage
            </th>
            <th scope="col" className={header}>
              Primary Metric
            </th>
            <th scope="col" className={header}>
              Last Active
            </th>
            <th scope="col" className={header}>
              Mentor
            </th>
            <th scope="col" className={header}>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group border-b border-line/70 last:border-0">
              <td className={cell}>
                <Link
                  to={paths.admin.startupDetail(row.id)}
                  className="flex min-w-0 items-center gap-2.5 text-ink hover:text-primary"
                >
                  <Avatar
                    name={row.name}
                    src={publicFileUrl('startup-logos', row.logo_path)}
                    size="sm"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium" title={row.name}>
                      {row.name}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {row.founder_name || '—'}
                    </span>
                  </span>
                </Link>
              </td>
              <td className={cn(cell, 'text-muted')}>
                <span className="block truncate text-ink">{row.industry ?? '—'}</span>
                <span className="block truncate text-[12px]">{stageName(row.journey_stage)}</span>
              </td>
              <td className={cell}>
                {row.primary_metric_name ? (
                  <>
                    <span className="block truncate text-[12px] text-muted">
                      {row.primary_metric_name}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="whitespace-nowrap font-medium tabular-nums text-ink">
                        {metricValue(row)}
                      </span>
                      <ChangePill
                        change={describeMetricChange(
                          row.primary_metric_previous,
                          row.primary_metric_value,
                        )}
                      />
                    </span>
                  </>
                ) : (
                  <span className="text-subtle">No metrics yet</span>
                )}
              </td>
              <td className={cn(cell, 'whitespace-nowrap text-muted')}>
                {formatRelativeDay(row.last_active_on)}
              </td>
              <td className={cn(cell, 'truncate text-muted')} title={row.mentor_name ?? undefined}>
                {row.mentor_name ?? <span className="text-subtle">Unassigned</span>}
              </td>
              <td className={cell}>
                <ActivityBadge status={row.activity_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StartupCards({ rows }: { rows: StartupListRow[] }) {
  return (
    <ul className="space-y-2 lg:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            to={paths.admin.startupDetail(row.id)}
            className="block rounded-xl border border-line bg-white p-4 shadow-card hover:border-primary/30"
          >
            <div className="flex items-start gap-3">
              <Avatar
                name={row.name}
                src={publicFileUrl('startup-logos', row.logo_path)}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[14px] font-semibold text-ink">{row.name}</p>
                  <ActivityBadge status={row.activity_status} />
                </div>
                <p className="truncate text-[12.5px] text-muted">
                  {row.founder_name || 'Founder'} ·{' '}
                  {[row.industry, stageName(row.journey_stage)].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                  <span className="text-muted">{row.primary_metric_name ?? 'No metrics'}</span>
                  {row.primary_metric_name && (
                    <span className="font-medium text-ink">{metricValue(row)}</span>
                  )}
                  <ChangePill
                    change={describeMetricChange(
                      row.primary_metric_previous,
                      row.primary_metric_value,
                    )}
                  />
                </div>
                <p className="mt-1 text-[12px] text-subtle">
                  {formatRelativeDay(row.last_active_on)} · {row.mentor_name ?? 'No mentor'}
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
