import { z } from 'zod';
import { optionalAmount, optionalText } from '@/domain/form-fields';
import { CURRENCIES } from '@/domain/options';
import {
  BUSINESS_TYPES,
  PRODUCT_STAGES,
  ROUND_TYPES,
  type ReadinessProfile,
} from '@/domain/readiness';

const choice = <T extends string>(values: readonly T[]) =>
  z
    .union([z.enum(values as [T, ...T[]]), z.literal('')])
    .transform((value) => (value === '' ? null : value));

const yesNo = z
  .enum(['yes', 'no', ''])
  .transform((value) => (value === '' ? null : value === 'yes'));

const positive = (message: string) =>
  optionalAmount().refine((value) => value === null || value > 0, message);

/** The editable readiness profile, grouped by the section that edits it. */
export const PROFILE_GROUPS = {
  company: ['business_type', 'product_stage'],
  team: ['founder_experience', 'founder_commitment'],
  fundraising: [
    'is_fundraising',
    'round_type',
    'target_raise',
    'raise_currency',
    'use_of_funds',
    'runway_months',
    'previous_funding',
    'round_outcome',
    'valuation',
  ],
  legal: [
    'company_registered',
    'jurisdiction',
    'legal_entity_name',
    'cap_table_prepared',
    'ip_ownership_clear',
    'has_legal_blockers',
    'legal_blockers_note',
  ],
} as const;
export type ProfileGroup = keyof typeof PROFILE_GROUPS;

export const readinessProfileSchema = z
  .object({
    business_type: choice(BUSINESS_TYPES),
    product_stage: choice(PRODUCT_STAGES.map((s) => s.value)),
    founder_experience: optionalText(2000),
    founder_commitment: choice(['full_time', 'part_time'] as const),
    is_fundraising: yesNo,
    round_type: choice(ROUND_TYPES.map((r) => r.value)),
    target_raise: positive('Use an amount above zero.'),
    raise_currency: choice(CURRENCIES),
    use_of_funds: optionalText(2000),
    runway_months: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null;
        const number = Number(value);
        if (!Number.isInteger(number) || number < 0 || number > 240) {
          ctx.addIssue({ code: 'custom', message: 'Use whole months from 0 to 240.' });
          return z.NEVER;
        }
        return number;
      }),
    previous_funding: optionalText(1000),
    round_outcome: optionalText(1000),
    valuation: positive('Use an amount above zero.'),
    company_registered: yesNo,
    jurisdiction: optionalText(120),
    legal_entity_name: optionalText(200),
    cap_table_prepared: yesNo,
    ip_ownership_clear: yesNo,
    has_legal_blockers: yesNo,
    legal_blockers_note: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    if ((value.target_raise !== null || value.valuation !== null) && !value.raise_currency) {
      ctx.addIssue({ code: 'custom', path: ['raise_currency'], message: 'Choose a currency.' });
    }
  })
  .transform((value) => ({
    ...value,
    // Values that no longer apply are cleared rather than kept out of sight.
    legal_blockers_note: value.has_legal_blockers ? value.legal_blockers_note : null,
  }));

export type ReadinessProfileInput = z.input<typeof readinessProfileSchema>;

const str = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);
const yn = (value: boolean | null | undefined) =>
  value === null || value === undefined ? '' : value ? 'yes' : 'no';

export function toProfileForm(p: ReadinessProfile | null): ReadinessProfileInput {
  return {
    business_type: str(p?.business_type) as ReadinessProfileInput['business_type'],
    product_stage: str(p?.product_stage) as ReadinessProfileInput['product_stage'],
    founder_experience: str(p?.founder_experience),
    founder_commitment: str(p?.founder_commitment) as ReadinessProfileInput['founder_commitment'],
    is_fundraising: yn(p?.is_fundraising),
    round_type: str(p?.round_type) as ReadinessProfileInput['round_type'],
    target_raise: str(p?.target_raise),
    raise_currency: str(p?.raise_currency) as ReadinessProfileInput['raise_currency'],
    use_of_funds: str(p?.use_of_funds),
    runway_months: str(p?.runway_months),
    previous_funding: str(p?.previous_funding),
    round_outcome: str(p?.round_outcome),
    valuation: str(p?.valuation),
    company_registered: yn(p?.company_registered),
    jurisdiction: str(p?.jurisdiction),
    legal_entity_name: str(p?.legal_entity_name),
    cap_table_prepared: yn(p?.cap_table_prepared),
    ip_ownership_clear: yn(p?.ip_ownership_clear),
    has_legal_blockers: yn(p?.has_legal_blockers),
    legal_blockers_note: str(p?.legal_blockers_note),
  };
}

/** Only the columns of one group are sent, so other sections are never touched. */
export function profilePatch(
  group: ProfileGroup,
  values: z.output<typeof readinessProfileSchema>,
): Partial<z.output<typeof readinessProfileSchema>> {
  return Object.fromEntries(PROFILE_GROUPS[group].map((key) => [key, values[key]]));
}
