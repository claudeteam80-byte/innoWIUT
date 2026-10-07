import { z } from 'zod';
import { localToday, optionalText } from '@/domain/form-fields';
import { MEETING_REASONS } from '@/domain/options';

export const meetingRequestSchema = z.object({
  reason: z.enum(MEETING_REASONS, { error: 'Choose a reason for the meeting.' }),
  message: optionalText(2000),
  preferred_date: z
    .string()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Choose a valid date.')
    .refine((value) => !value || value >= localToday(), 'Choose today or a future date.')
    .transform((value) => value || null),
});

export type MeetingRequestInput = z.input<typeof meetingRequestSchema>;
