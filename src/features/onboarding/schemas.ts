import { z } from 'zod';
import { amount, optionalUrl, phoneNumber, requiredText } from '@/domain/form-fields';
import { CURRENCIES, FOUNDER_ROLES } from '@/domain/options';
import { startupInfoFields } from '@/features/startup/schemas';

const yesNo = z.enum(['yes', 'no'], { error: 'Choose yes or no.' });

export const aboutYouSchema = z.object({
  full_name: requiredText('Enter your full name.', 120),
  phone: phoneNumber,
  linkedin_url: optionalUrl('Enter a valid LinkedIn URL.'),
  role_in_startup: z.enum(FOUNDER_ROLES, { error: 'Choose your role.' }),
});

export const startupStepSchema = z.object(startupInfoFields);

export const progressSchema = z
  .object({
    has_product: yesNo,
    has_users: yesNo,
    current_users: z.string(),
    has_revenue: yesNo,
    monthly_revenue: z.string(),
    revenue_currency: z.union([z.enum(CURRENCIES), z.literal('')]),
    main_goal: requiredText('Add your current main goal.', 2000),
    biggest_challenge: requiredText('Add your biggest current challenge.', 2000),
  })
  .superRefine((values, ctx) => {
    if (values.has_users === 'yes') {
      const parsed = amount('Enter your current number of users.').safeParse(values.current_users);
      if (!parsed.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['current_users'],
          message: parsed.error.issues[0]?.message ?? 'Invalid',
        });
      } else if (!Number.isInteger(parsed.data)) {
        ctx.addIssue({ code: 'custom', path: ['current_users'], message: 'Use a whole number.' });
      }
    }
    if (values.has_revenue === 'yes') {
      const parsed = amount('Enter your current monthly revenue.').safeParse(
        values.monthly_revenue,
      );
      if (!parsed.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['monthly_revenue'],
          message: parsed.error.issues[0]?.message ?? 'Invalid',
        });
      }
      if (!values.revenue_currency) {
        ctx.addIssue({ code: 'custom', path: ['revenue_currency'], message: 'Choose a currency.' });
      }
    }
  });

export const onboardingStepSchemas = [aboutYouSchema, startupStepSchema, progressSchema] as const;

export type OnboardingFormValues = z.input<typeof aboutYouSchema> &
  z.input<typeof startupStepSchema> &
  z.input<typeof progressSchema>;

export const ONBOARDING_STEP_FIELDS: (keyof OnboardingFormValues)[][] = [
  ['full_name', 'phone', 'linkedin_url', 'role_in_startup'],
  ['name', 'tagline', 'industry', 'stage', 'website', 'founded_year', 'team_size', 'description'],
  [
    'has_product',
    'has_users',
    'current_users',
    'has_revenue',
    'monthly_revenue',
    'revenue_currency',
    'main_goal',
    'biggest_challenge',
  ],
];

export const emptyOnboardingValues = (fullName = ''): OnboardingFormValues => ({
  full_name: fullName,
  phone: '',
  linkedin_url: '',
  role_in_startup: '' as never,
  name: '',
  tagline: '',
  description: '',
  industry: '' as never,
  stage: '' as never,
  website: '',
  founded_year: '',
  team_size: '',
  has_product: '' as never,
  has_users: '' as never,
  current_users: '',
  has_revenue: '' as never,
  monthly_revenue: '',
  revenue_currency: '',
  main_goal: '',
  biggest_challenge: '',
});

/** Validates every step and builds the payload for public.complete_onboarding(). */
export function buildOnboardingPayload(values: OnboardingFormValues) {
  const about = aboutYouSchema.parse(values);
  const startup = startupStepSchema.parse(values);
  const progress = progressSchema.parse(values);
  const hasUsers = progress.has_users === 'yes';
  const hasRevenue = progress.has_revenue === 'yes';
  return {
    full_name: about.full_name,
    phone: about.phone,
    linkedin_url: about.linkedin_url,
    role_in_startup: about.role_in_startup,
    name: startup.name,
    tagline: startup.tagline,
    description: startup.description,
    industry: startup.industry,
    stage: startup.stage,
    website: startup.website,
    founded_year: startup.founded_year,
    team_size: startup.team_size,
    has_product: progress.has_product === 'yes',
    has_users: hasUsers,
    current_users: hasUsers ? Number(progress.current_users) : null,
    has_revenue: hasRevenue,
    monthly_revenue: hasRevenue ? Number(progress.monthly_revenue) : null,
    revenue_currency: hasRevenue ? progress.revenue_currency || null : null,
    main_goal: progress.main_goal,
    biggest_challenge: progress.biggest_challenge,
  };
}

export type OnboardingPayload = ReturnType<typeof buildOnboardingPayload>;
