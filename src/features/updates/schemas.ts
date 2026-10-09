import { z } from 'zod';
import { optionalText } from '@/domain/form-fields';
import { OPEN_STAGE_KEYS, PROGRESS_TYPES } from '@/domain/journey';

export type UpdateAction = 'draft' | 'publish';

// Structured update (V2.1). V1 columns (highlights, challenge, next_steps, image, link) are
// not edited by the composer — they stay exactly as written and still render.
const baseFields = {
  title: z
    .string()
    .trim()
    .min(1, 'Give your update a headline.')
    .max(200, 'Use 200 characters or fewer.'),
  progress_types: z.array(z.enum(PROGRESS_TYPES)).max(PROGRESS_TYPES.length),
  blocker: optionalText(2000),
  next_milestone: optionalText(300),
  next_milestone_date: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Choose a valid date.')
    .transform((value) => value || null),
  linked_stage: z
    .union([z.enum(OPEN_STAGE_KEYS), z.literal('')])
    .transform((value) => value || null),
};

/** Drafts only need a headline. */
export const draftUpdateSchema = z.object({ ...baseFields, summary: optionalText(4000) });

/** Publishing also needs "What moved?" and at least one progress type. */
export const publishUpdateSchema = z.object({
  ...baseFields,
  summary: z
    .string()
    .trim()
    .min(1, 'Describe what moved before publishing.')
    .max(4000, 'Use 4000 characters or fewer.'),
  progress_types: baseFields.progress_types.min(1, 'Choose at least one progress type.'),
});

export const updateSchemaFor = (action: UpdateAction) =>
  action === 'publish' ? publishUpdateSchema : draftUpdateSchema;

export type UpdateFormValues = z.input<typeof draftUpdateSchema>;

/** Row values for startup_updates. Status follows the button the founder pressed. */
export function buildUpdateRow(values: UpdateFormValues, action: UpdateAction) {
  const parsed = updateSchemaFor(action).parse(values);
  return {
    title: parsed.title,
    summary: parsed.summary || null,
    progress_types: parsed.progress_types,
    blocker: parsed.blocker,
    next_milestone: parsed.next_milestone,
    next_milestone_date: parsed.next_milestone_date,
    linked_stage: parsed.linked_stage,
    status: action === 'publish' ? ('published' as const) : ('draft' as const),
  };
}

/** A V1 draft can be published from its card only once it has what a V2.1 update needs. */
export function canQuickPublish(update: {
  summary: string | null;
  progress_types: readonly string[];
}): boolean {
  return Boolean(update.summary?.trim()) && update.progress_types.length > 0;
}
