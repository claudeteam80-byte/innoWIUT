import type { BadgeTone } from '@/components/ui/Badge';
import type { Enums } from '@/types/database';

export const ROLE_META: Record<Enums<'app_role'>, { label: string; tone: BadgeTone }> = {
  founder: { label: 'Founder', tone: 'neutral' },
  admin: { label: 'Admin', tone: 'blue' },
  superadmin: { label: 'Superadmin', tone: 'warning' },
};
