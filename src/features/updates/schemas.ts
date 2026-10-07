import { z } from 'zod';
import { optionalText, optionalUrl } from '@/domain/form-fields';

export type UpdateAction = 'draft' | 'publish';

const baseFields = {
  title: z
    .string()
    .trim()
    .min(1, 'Give your update a title.')
    .max(200, 'Use 200 characters or fewer.'),
  highlights: z
    .array(z.object({ text: z.string().trim().max(300, 'Use 300 characters or fewer.') }))
    .max(20),
  challenge: optionalText(2000),
  next_steps: optionalText(2000),
  link_url: optionalUrl('Enter a valid link.'),
};

/** Drafts only need a title. */
export const draftUpdateSchema = z.object({ ...baseFields, summary: optionalText(4000) });

/** Publishing also needs "What happened?". */
export const publishUpdateSchema = z.object({
  ...baseFields,
  summary: z
    .string()
    .trim()
    .min(1, 'Describe what happened before publishing.')
    .max(4000, 'Use 4000 characters or fewer.'),
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
    highlights: parsed.highlights.map((item) => item.text).filter(Boolean),
    challenge: parsed.challenge,
    next_steps: parsed.next_steps,
    link_url: parsed.link_url,
    status: action === 'publish' ? ('published' as const) : ('draft' as const),
  };
}
