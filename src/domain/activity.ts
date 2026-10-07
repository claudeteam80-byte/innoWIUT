import { differenceInCalendarDays } from 'date-fns';
import { parseDate } from './dates';

/**
 * Startup activity buckets. Must stay in sync with public.activity_status()
 * in supabase/migrations.
 *   0–7 days since last activity  → Active
 *   8–14 days                     → Needs Update
 *   15+ days, or no activity      → Inactive
 */
export const ACTIVITY_THRESHOLDS = {
  activeMaxDays: 7,
  needsUpdateMaxDays: 14,
} as const;

export type ActivityKey = 'active' | 'needs_update' | 'inactive';
export type ActivityTone = 'positive' | 'warning' | 'danger';

export interface ActivityStatus {
  key: ActivityKey;
  label: string;
  tone: ActivityTone;
  /** Whole calendar days since the last activity, or null when there was none. */
  days: number | null;
}

type DateInput = string | Date | null | undefined;

export function daysSince(value: DateInput, now: Date = new Date()): number | null {
  const date = parseDate(value);
  if (!date) return null;
  return Math.max(0, differenceInCalendarDays(now, date));
}

export function activityFromDays(days: number | null): ActivityStatus {
  if (days === null || !Number.isFinite(days)) {
    return { key: 'inactive', label: 'Inactive', tone: 'danger', days: null };
  }
  if (days <= ACTIVITY_THRESHOLDS.activeMaxDays) {
    return { key: 'active', label: 'Active', tone: 'positive', days };
  }
  if (days <= ACTIVITY_THRESHOLDS.needsUpdateMaxDays) {
    return { key: 'needs_update', label: 'Needs Update', tone: 'warning', days };
  }
  return { key: 'inactive', label: 'Inactive', tone: 'danger', days };
}

export function getActivityStatus(lastActive: DateInput, now: Date = new Date()): ActivityStatus {
  return activityFromDays(daysSince(lastActive, now));
}

/** Most recent of the given dates (published update, traction record, startup creation…). */
export function latestActivityDate(...values: DateInput[]): Date | null {
  return values
    .map(parseDate)
    .filter((date): date is Date => date !== null)
    .reduce<Date | null>((latest, date) => (!latest || date > latest ? date : latest), null);
}
