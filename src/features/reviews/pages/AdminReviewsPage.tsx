import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ClipboardCheck, Search } from 'lucide-react';
import { paths } from '@/app/paths';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';
import { SelectField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { inputClasses } from '@/components/ui/TextField';
import { formatDate } from '@/domain/dates';
import { JOURNEY_STAGES, stageName } from '@/domain/journey';
import { Pagination } from '@/features/admin/components/Pagination';
import { cn } from '@/lib/cn';
import { publicFileUrl } from '@/lib/storage';
import { REVIEW_PAGE_SIZE, type ReviewQueueParams, type ReviewQueueRow } from '../api';
import { ReviewStatusPill } from '../components/ReviewStatusPill';
import { useReviewQueue } from '../hooks';
import {
  queueParamsFromSearch,
  REVIEW_TABS,
  REVIEW_TYPES,
  searchFromQueueParams,
} from '../queue-params';

const REVIEWABLE_STAGES = JOURNEY_STAGES.filter((s) =>
  ['idea', 'validation', 'mvp', 'traction', 'investor_readiness'].includes(s.key),
);

const waiting = (row: ReviewQueueRow) =>
  row.status === 'pending' ? `${row.days_waiting} ${row.days_waiting === 1 ? 'day' : 'days'}` : '—';

export function AdminReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = queueParamsFromSearch(searchParams);
  const [searchText, setSearchText] = useState(params.search);
  const queue = useReviewQueue(params);

  const update = (patch: Partial<ReviewQueueParams>) =>
    setSearchParams(searchFromQueueParams({ ...params, page: 1, ...patch }), { replace: true });

  useEffect(() => {
    if (searchText === params.search) return;
    const timer = window.setTimeout(() => update({ search: searchText }), 300);
    return () => window.clearTimeout(timer);
  });

  const filtered = Boolean(params.search || params.stage || params.type);
  const rows = queue.data?.rows ?? [];
  const tabLabel = REVIEW_TABS.find((t) => t.value === params.tab)?.label ?? '';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="innoWIUT"
        title="Reviews"
        subtitle="Review founder progress, stage transitions and Investor Readiness."
      />

      <div className="overflow-x-auto">
        <Tabs
          label="Review status"
          value={params.tab}
          onChange={(tab) => update({ tab })}
          tabs={REVIEW_TABS}
        />
      </div>

      <section
        aria-label="Filters"
        className="grid gap-3 rounded-xl border border-line bg-white p-4 shadow-card md:grid-cols-2 xl:grid-cols-5"
      >
        <div className="relative md:col-span-2">
          <label htmlFor="review-search" className="mb-1.5 block text-[13px] font-medium text-ink">
            Search
          </label>
          <Search
            className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-subtle"
            aria-hidden="true"
          />
          <input
            id="review-search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Startup or founder name"
            className={cn(inputClasses, 'pl-9')}
          />
        </div>
        <SelectField
          label="Review type"
          value={params.type}
          onChange={(e) => update({ type: e.target.value as ReviewQueueParams['type'] })}
          placeholder="All types"
          options={REVIEW_TYPES}
        />
        <SelectField
          label="Stage"
          value={params.stage}
          onChange={(e) => update({ stage: e.target.value })}
          placeholder="All stages"
          options={REVIEWABLE_STAGES.map((s) => ({ value: s.key, label: s.name }))}
        />
        <SelectField
          label="Sort"
          value={params.sort}
          onChange={(e) => update({ sort: e.target.value as ReviewQueueParams['sort'] })}
          options={[
            { value: 'oldest', label: 'Oldest first' },
            { value: 'newest', label: 'Newest first' },
          ]}
        />
      </section>

      {queue.isError ? (
        <ErrorState description="We couldn't load reviews." onRetry={() => void queue.refetch()} />
      ) : queue.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading reviews">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={
            filtered
              ? 'No reviews match these filters'
              : params.tab === 'pending'
                ? 'No reviews waiting'
                : `No ${tabLabel.toLowerCase()} reviews`
          }
          description={
            filtered
              ? 'Try a different search, type or stage.'
              : 'Founders request a stage review once every required milestone is complete.'
          }
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchText('');
                  update({ search: '', stage: '', type: '' });
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div
          className={cn('space-y-4 transition-opacity', queue.isPlaceholderData && 'opacity-60')}
        >
          <ReviewTable rows={rows} />
          <ReviewCards rows={rows} />
          <Pagination
            label="Reviews"
            page={params.page}
            pageSize={REVIEW_PAGE_SIZE}
            total={queue.data.total}
            onPageChange={(page) => setSearchParams(searchFromQueueParams({ ...params, page }))}
          />
        </div>
      )}
    </div>
  );
}

function ReviewKind({ row }: { row: ReviewQueueRow }) {
  return row.review_type === 'investor_readiness' ? (
    <span>
      Investor Readiness
      <span className="block text-[11.5px] text-muted">Readiness review</span>
    </span>
  ) : (
    <>
      {stageName(row.from_stage)} → {stageName(row.to_stage)}
    </>
  );
}

function StartupCell({ row }: { row: ReviewQueueRow }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar
        name={row.startup_name}
        src={publicFileUrl('startup-logos', row.startup_logo_path)}
        size="sm"
      />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink" title={row.startup_name}>
          {row.startup_name}
        </span>
        <span className="block truncate text-[12px] text-muted">
          {row.founder_name || row.founder_email}
        </span>
      </span>
    </span>
  );
}

function ReviewTable({ rows }: { rows: ReviewQueueRow[] }) {
  const cell = 'px-3 py-3 align-middle';
  const header =
    'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted whitespace-nowrap';
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-line bg-white shadow-card lg:block">
      <table className="w-full table-fixed text-[12.5px]">
        <caption className="sr-only">Stage reviews</caption>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[15%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[13%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead className="border-b border-line bg-canvas-subtle">
          <tr>
            {['Startup', 'Stage', 'Progress', 'Evidence', 'Requested', 'Waiting', 'Status', ''].map(
              (title, i) => (
                <th key={i} scope="col" className={header}>
                  {title || <span className="sr-only">Action</span>}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-canvas-subtle">
              <td className={cell}>
                <StartupCell row={row} />
              </td>
              <td className={cn(cell, 'text-ink')}>
                <ReviewKind row={row} />
              </td>
              <td className={cn(cell, 'text-ink')}>
                {row.requirements_completed}/{row.requirements_total}
              </td>
              <td className={cn(cell, 'text-ink')}>{row.evidence_count}</td>
              <td className={cn(cell, 'text-muted')}>{formatDate(row.requested_at)}</td>
              <td
                className={cn(
                  cell,
                  row.days_waiting > 3 && row.status === 'pending'
                    ? 'font-medium text-warning-strong'
                    : 'text-muted',
                )}
              >
                {waiting(row)}
              </td>
              <td className={cell}>
                <ReviewStatusPill state={row.status} type={row.review_type} />
              </td>
              <td className={cn(cell, 'text-right')}>
                <Link
                  to={paths.admin.reviewDetail(row.id)}
                  className={buttonClasses({
                    variant: row.status === 'pending' ? 'primary' : 'outline',
                    size: 'sm',
                  })}
                  aria-label={`Review ${row.startup_name}`}
                >
                  {row.status === 'pending' ? 'Review' : 'Open'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewCards({ rows }: { rows: ReviewQueueRow[] }) {
  return (
    <ul className="space-y-3 lg:hidden" aria-label="Stage reviews">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <StartupCell row={row} />
            <ReviewStatusPill state={row.status} type={row.review_type} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
            <div>
              <dt className="text-muted">Stage</dt>
              <dd className="text-ink">
                <ReviewKind row={row} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Progress</dt>
              <dd className="text-ink">
                {row.requirements_completed}/{row.requirements_total} · {row.evidence_count}{' '}
                evidence
              </dd>
            </div>
            <div>
              <dt className="text-muted">Requested</dt>
              <dd className="text-ink">{formatDate(row.requested_at)}</dd>
            </div>
            <div>
              <dt className="text-muted">Waiting</dt>
              <dd className="text-ink">{waiting(row)}</dd>
            </div>
          </dl>
          <Link
            to={paths.admin.reviewDetail(row.id)}
            className={buttonClasses({
              variant: row.status === 'pending' ? 'primary' : 'outline',
              fullWidth: true,
              className: 'mt-3',
            })}
            aria-label={`Review ${row.startup_name}`}
          >
            {row.status === 'pending' ? 'Review' : 'Open'}
          </Link>
        </li>
      ))}
    </ul>
  );
}
