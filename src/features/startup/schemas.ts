import { z } from 'zod';
import {
  currentYear,
  optionalText,
  optionalUrl,
  requiredInt,
  requiredText,
} from '@/domain/form-fields';
import { INDUSTRIES } from '@/domain/options';

export const startupInfoFields = {
  name: requiredText('Enter your startup name.', 120),
  tagline: requiredText('Add a one-line description.', 200),
  description: optionalText(4000),
  industry: z.enum(INDUSTRIES, { error: 'Choose an industry.' }),
  website: optionalUrl(),
  founded_year: requiredInt(
    'Enter the year you started.',
    1900,
    currentYear(),
    `Use a year between 1900 and ${currentYear()}.`,
  ),
  team_size: requiredInt('Enter your team size.', 1, 10000, 'Use a whole number from 1 to 10,000.'),
};

export const startupProfileSchema = z.object({
  ...startupInfoFields,
  main_goal: requiredText('Add your current main goal.', 2000),
  biggest_challenge: requiredText('Add your biggest current challenge.', 2000),
});

export type StartupProfileInput = z.input<typeof startupProfileSchema>;
export type StartupProfileOutput = z.output<typeof startupProfileSchema>;

export const teamMemberSchema = z.object({
  name: requiredText("Enter your teammate's name.", 120),
  role: optionalText(120),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((value) => !value || z.email().safeParse(value).success, 'Enter a valid email address.')
    .transform((value) => value.toLowerCase() || null),
  linkedin_url: optionalUrl('Enter a valid LinkedIn URL.'),
});

export type TeamMemberInput = z.input<typeof teamMemberSchema>;
export type TeamMemberOutput = z.output<typeof teamMemberSchema>;
