import type { BadgeTone } from '@/components/ui/Badge';
import type { Enums } from '@/types/database';

export const MEETING_STATUS_META: Record<
  Enums<'meeting_request_status'>,
  { label: string; tone: BadgeTone }
> = {
  requested: { label: 'Requested', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'positive' },
  completed: { label: 'Completed', tone: 'blue' },
  declined: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};
