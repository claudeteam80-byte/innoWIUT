import { z } from 'zod';
import { optionalUrl, phoneNumber, requiredText } from '@/domain/form-fields';

export const profileSettingsSchema = z.object({
  full_name: requiredText('Enter your full name.', 120),
  phone: phoneNumber,
  linkedin_url: optionalUrl('Enter a valid LinkedIn URL.'),
});

export type ProfileSettingsInput = z.input<typeof profileSettingsSchema>;
