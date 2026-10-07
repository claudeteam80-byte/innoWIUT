import { Badge } from '@/components/ui/Badge';
import { MEETING_STATUS_META } from '@/domain/meetings';
import type { MeetingStatus } from '../api';

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const meta = MEETING_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
