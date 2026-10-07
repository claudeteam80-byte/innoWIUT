import { z } from 'zod';
import { telegramUrl } from '@/domain/contact';
import { optionalText, optionalUrl, pastOrTodayDate, requiredText } from '@/domain/form-fields';

export const mentorSchema = z.object({
  name: requiredText("Enter the mentor's full name.", 120),
  title: optionalText(120),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => !value || z.email().safeParse(value).success, 'Enter a valid email address.')
    .transform((value) => value.toLowerCase() || null),
  telegram: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => !value || telegramUrl(value) !== null,
      'Enter a Telegram @username or t.me link.',
    )
    .transform((value) => value || null),
  linkedin_url: optionalUrl('Enter a valid LinkedIn URL.'),
  expertise: z
    .string()
    .max(500)
    .transform((value) =>
      [
        ...new Set(
          value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ].map((item) => item.slice(0, 40)),
    )
    .refine((items) => items.length > 0, 'Add at least one area of expertise.')
    .refine((items) => items.length <= 10, 'Use at most 10 areas of expertise.'),
  bio: optionalText(4000),
  is_active: z.boolean(),
});

export type MentorFormInput = z.input<typeof mentorSchema>;
export type MentorFormOutput = z.output<typeof mentorSchema>;

export const mentorNoteSchema = z.object({
  body: requiredText('Write the guidance the founder should see.', 4000),
  note_date: pastOrTodayDate(),
});

export type MentorNoteInput = z.input<typeof mentorNoteSchema>;

export const ADMIN_MEETING_STATUSES = ['requested', 'confirmed', 'completed', 'declined'] as const;

export const meetingUpdateSchema = z.object({
  status: z.enum(ADMIN_MEETING_STATUSES, { error: 'Choose a status.' }),
  admin_response: optionalText(2000),
});

export type MeetingUpdateInput = z.input<typeof meetingUpdateSchema>;
