import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/domain/dates';
import { MEETING_STATUS_META } from '@/domain/meetings';
import type { MeetingRequest } from '../api';

export function MeetingRequests({ requests }: { requests: MeetingRequest[] }) {
  return (
    <ul className="space-y-3">
      {requests.map((request) => {
        const status = MEETING_STATUS_META[request.status];
        return (
          <li key={request.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13.5px] font-medium text-ink">{request.reason}</p>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            {request.message && <p className="mt-1.5 text-[13px] text-muted">{request.message}</p>}
            <p className="mt-2 text-[12px] text-subtle">
              Requested {formatDate(request.created_at)}
              {request.preferred_date
                ? ` · Preferred date ${formatDate(request.preferred_date)}`
                : ''}
            </p>
            {request.admin_response && (
              <p className="mt-2 rounded-md bg-canvas px-3 py-2 text-[12.5px] text-ink">
                <span className="font-medium">innoWIUT: </span>
                {request.admin_response}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
