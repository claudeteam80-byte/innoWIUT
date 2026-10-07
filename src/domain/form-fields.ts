import { z } from 'zod';

/** Required trimmed text with a max length. */
export const requiredText = (message: string, max: number) =>
  z.string().trim().min(1, message).max(max, `Use ${max} characters or fewer.`);

/** Optional trimmed text; empty becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .transform((value) => value || null);

/** Optional web address; adds https:// when missing; empty becomes null. */
export const optionalUrl = (message = 'Enter a valid web address.') =>
  z
    .string()
    .trim()
    .max(300, 'Use 300 characters or fewer.')
    .transform((value) => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value))
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return (
          (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')
        );
      } catch {
        return false;
      }
    }, message)
    .transform((value) => value || null);

/** Required whole number typed into a text input. */
export const requiredInt = (message: string, min: number, max: number, rangeMessage: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .pipe(
      z.coerce
        .number<string>({ error: message })
        .int(rangeMessage)
        .min(min, rangeMessage)
        .max(max, rangeMessage),
    );

/** Non-negative amount typed into a text input (decimals allowed). */
export const amount = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .pipe(
      z.coerce
        .number<string>({ error: 'Enter a number.' })
        .refine(Number.isFinite, 'Enter a number.')
        .refine((value) => value >= 0, 'Use zero or more.')
        .refine((value) => value <= 1e15, 'That number is too large.'),
    );

/** Optional non-negative amount; empty becomes null. */
export const optionalAmount = () =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const number = Number(value);
      if (!Number.isFinite(number)) {
        ctx.addIssue({ code: 'custom', message: 'Enter a number.' });
        return z.NEVER;
      }
      if (number < 0) {
        ctx.addIssue({ code: 'custom', message: 'Use zero or more.' });
        return z.NEVER;
      }
      return number;
    });

export const phoneNumber = z
  .string()
  .trim()
  .min(1, 'Enter your phone number.')
  .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number, e.g. +998 90 123 45 67.');

/** YYYY-MM-DD, not later than today (local). */
export const pastOrTodayDate = (message = 'Choose a date.') =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, message)
    .refine((value) => value <= localToday(), 'The date cannot be in the future.');

export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const currentYear = () => new Date().getFullYear();
