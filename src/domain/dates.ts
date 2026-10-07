import { isValid } from 'date-fns';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a Postgres `date` ("2026-10-07") as a local calendar date, or an ISO
 * timestamp as an instant. Returns null for empty or invalid input.
 */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return isValid(value) ? value : null;

  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.getMonth() === Number(month) - 1 ? date : null;
  }

  const date = new Date(value);
  return isValid(date) ? date : null;
}

/** "Today", "Yesterday", "3 days ago", or "Oct 2, 2026". */
export function formatRelativeDay(
  value: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const date = parseDate(value);
  if (!date) return '—';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

export function formatDate(
  value: string | Date | null | undefined,
  style: 'short' | 'long' = 'short',
): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
