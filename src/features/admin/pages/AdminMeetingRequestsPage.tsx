import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { paths } from '@/app/paths';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { formatDate } from '@/domain/dates';
import { MEETING_STATUS_META } from '@/domain/meetings';
import { founderKeys } from '@/features/founder-keys';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import {
  MEETINGS_PAGE_SIZE,
  updateMeetingRequest,
  type AdminMeetingRequest,
  type MeetingStatus,
} from '../api';
import { MeetingStatusBadge } from '../components/MeetingStatusBadge';
import { Pagination } from '../components/Pagination';
import { useMeetingRequests } from '../hooks';
import { adminKeys } from '../keys';
import { ADMIN_MEETING_STATUSES, meetingUpdateSchema, type MeetingUpdateInput } from '../schemas';

type Filter = MeetingStatus | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...ADMIN_MEETING_STATUSES.map((status) => ({
    value: status,
    label: MEETING_STATUS_META[status].label,
  })),
];

export function AdminMeetingRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') as Filter | null;
  const status: Filter = FILTERS.some((f) => f.value === statusParam)
    ? (statusParam as Filter)
    : 'all';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const requests = useMeetingRequests(status, page);
  const [managing, setManaging] = useState<AdminMeetingRequest | null>(null);

  const setFilter = (next: Filter) =>
    setSearchParams(next === 'all' ? {} : { status: next }, { replace: true });
  const rows = requests.data?.rows ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="innoWIUT"
        title="Meeting Requests"
        subtitle="Founder requests to meet their mentor. Confirm, complete or decline them here."
      />
      <div className="overflow-x-auto">
        <Tabs label="Filter by status" value={status} onChange={setFilter} tabs={FILTERS} />
      </div>

      {requests.isError ? (
        <ErrorState
          description="We couldn't load meeting requests."
          onRetry={() => void requests.refetch()}
        />
      ) : requests.isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading meeting requests">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No meeting requests"
          description={
            status === 'all'
              ? 'Requests appear here when founders ask to meet their mentor.'
              : `No ${MEETING_STATUS_META[status].label.toLowerCase()} requests.`
          }
        />
      ) : (
        <div className={cn('space-y-4', requests.isPlaceholderData && 'opacity-60')}>
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-white shadow-card lg:block">
            <table className="w-full text-[13px]">
              <caption className="sr-only">Meeting requests</caption>
              <thead className="border-b border-line bg-canvas-subtle">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="px-3 py-2.5">
                    Startup
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Founder
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Mentor
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Reason
                  </th>
                  <th scope="col" className="px-3 py-2.5 whitespace-nowrap">
                    Preferred Date
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Created
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2.5 font-medium">
                      {row.startup ? (
                        <Link
                          to={paths.admin.startupDetail(row.startup.id)}
                          className="text-ink hover:text-primary"
                        >
                          {row.startup.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {row.startup?.owner?.full_name || row.startup?.owner?.email || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{row.mentor?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-ink">
                      {row.reason}
                      {row.message && (
                        <p className="line-clamp-1 max-w-[260px] text-[12px] text-muted">
                          {row.message}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                      {row.preferred_date ? formatDate(row.preferred_date) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <MeetingStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setManaging(row)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 lg:hidden">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-line bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {row.startup?.name ?? '—'}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {row.startup?.owner?.full_name || 'Founder'} · Mentor{' '}
                      {row.mentor?.name ?? '—'}
                    </p>
                  </div>
                  <MeetingStatusBadge status={row.status} />
                </div>
                <p className="mt-2 text-[13px] text-ink">{row.reason}</p>
                {row.message && <p className="text-[12.5px] text-muted">{row.message}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[12px] text-subtle">
                    {formatDate(row.created_at)}
                    {row.preferred_date ? ` · prefers ${formatDate(row.preferred_date)}` : ''}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setManaging(row)}>
                    Manage
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            label="Meeting requests"
            page={page}
            pageSize={MEETINGS_PAGE_SIZE}
            total={requests.data.total}
            onPageChange={(next) =>
              setSearchParams({ ...(status === 'all' ? {} : { status }), page: String(next) })
            }
          />
        </div>
      )}
      <ManageMeetingDialog request={managing} onClose={() => setManaging(null)} />
    </div>
  );
}

function ManageMeetingDialog({
  request,
  onClose,
}: {
  request: AdminMeetingRequest | null;
  onClose: () => void;
}) {
  return request ? (
    <ManageMeetingForm key={request.id} request={request} onClose={onClose} />
  ) : null;
}

function ManageMeetingForm({
  request,
  onClose,
}: {
  request: AdminMeetingRequest;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const defaults: MeetingUpdateInput = {
    status: (ADMIN_MEETING_STATUSES as readonly string[]).includes(request.status)
      ? (request.status as MeetingUpdateInput['status'])
      : 'requested',
    admin_response: request.admin_response ?? '',
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(meetingUpdateSchema), defaultValues: defaults });

  const save = useMutation({
    mutationFn: (values: { status: MeetingStatus; admin_response: string | null }) =>
      updateMeetingRequest(request.id, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.meetingsAll }),
        queryClient.invalidateQueries({ queryKey: adminKeys.stats }),
        request.startup &&
          queryClient.invalidateQueries({ queryKey: founderKeys.meetings(request.startup.id) }),
      ]);
      toast.success('Meeting request updated. The founder sees the new status.');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't update this request.")),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !save.isPending && onClose()}
      title="Manage meeting request"
      description={`${request.startup?.name ?? 'Startup'} · ${request.reason}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="meeting-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-4 space-y-1 rounded-lg bg-canvas p-3 text-[13px]">
        <p>
          <span className="text-muted">Founder:</span>{' '}
          {request.startup?.owner?.full_name || request.startup?.owner?.email || '—'}
        </p>
        <p>
          <span className="text-muted">Mentor:</span> {request.mentor?.name ?? '—'}
        </p>
        <p>
          <span className="text-muted">Preferred date:</span>{' '}
          {request.preferred_date ? formatDate(request.preferred_date) : 'Not specified'}
        </p>
        {request.message && <p className="whitespace-pre-line pt-1 text-ink">{request.message}</p>}
      </div>
      <form
        id="meeting-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
        noValidate
        className="space-y-4"
      >
        <SelectField
          label="Status"
          required
          options={ADMIN_MEETING_STATUSES.map((status) => ({
            value: status,
            label: MEETING_STATUS_META[status].label,
          }))}
          error={errors.status?.message}
          {...register('status')}
        />
        <TextareaField
          label="Admin note"
          hint="Optional — shown to the founder, e.g. the confirmed time and place."
          rows={3}
          error={errors.admin_response?.message}
          {...register('admin_response')}
        />
      </form>
    </Dialog>
  );
}
