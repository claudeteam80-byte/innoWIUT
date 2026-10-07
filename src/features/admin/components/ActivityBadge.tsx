import { Badge } from '@/components/ui/Badge';
import { activityMeta } from '@/domain/activity';

export function ActivityBadge({ status }: { status: string | null | undefined }) {
  const meta = activityMeta(status);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
