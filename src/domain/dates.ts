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
