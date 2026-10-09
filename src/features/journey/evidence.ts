import { optionalUrl } from '@/domain/form-fields';
import type { EvidenceType } from '@/domain/journey';
import { storagePath, uploadWithProgress, removeFile, validateEvidenceFile } from '@/lib/storage';
import { addEvidence, type EvidenceInsert } from './api';

/** One piece of evidence being composed in a form (before it is saved). */
export interface EvidenceDraft {
  evidence_type: EvidenceType;
  label: string;
  url: string;
  text_value: string;
  linked_metric_id: string;
  requirement_id: string;
  file: File | null;
}

export type EvidenceErrors = Partial<
  Record<'label' | 'url' | 'text_value' | 'linked_metric_id' | 'file', string>
>;

export const emptyEvidence = (type: EvidenceType = 'link', requirementId = ''): EvidenceDraft => ({
  evidence_type: type,
  label: '',
  url: '',
  text_value: '',
  linked_metric_id: '',
  requirement_id: requirementId,
  file: null,
});

export const needsUrl = (type: EvidenceType) => type === 'link' || type === 'product_url';
export const needsText = (type: EvidenceType) =>
  type === 'customer_feedback' || type === 'text_note';
export const needsFile = (type: EvidenceType) => type === 'screenshot' || type === 'document';

const urlField = optionalUrl('Enter a valid link, e.g. https://example.com.');

/**
 * Validates a draft and returns the database row (without stage / update / file path).
 * Only the value that proves the evidence type is kept, matching the table's check constraint.
 */
export function parseEvidenceDraft(
  draft: EvidenceDraft,
):
  | { ok: true; row: Omit<EvidenceInsert, 'stage' | 'update_id' | 'file_path'> }
  | { ok: false; errors: EvidenceErrors } {
  const errors: EvidenceErrors = {};
  const type = draft.evidence_type;
  const label = draft.label.trim();
  if (!label) errors.label = 'Give this evidence a short label.';
  else if (label.length > 200) errors.label = 'Use 200 characters or fewer.';

  let url: string | null = null;
  if (needsUrl(type)) {
    const parsed = urlField.safeParse(draft.url);
    if (!parsed.success) errors.url = parsed.error.issues[0]?.message;
    else if (!parsed.data) errors.url = 'Add the link.';
    else url = parsed.data;
  }

  let text: string | null = null;
  if (needsText(type)) {
    text = draft.text_value.trim();
    if (!text)
      errors.text_value =
        type === 'customer_feedback' ? 'Add what the customer said.' : 'Add the note.';
    else if (text.length > 2000) errors.text_value = 'Use 2000 characters or fewer.';
  }

  if (type === 'metric' && !draft.linked_metric_id)
    errors.linked_metric_id = 'Choose a traction metric.';

  if (needsFile(type)) {
    if (!draft.file)
      errors.file = type === 'screenshot' ? 'Choose a screenshot.' : 'Choose a file.';
    else {
      const fileError = validateEvidenceFile(
        draft.file,
        type === 'screenshot' ? 'screenshot' : 'document',
      );
      if (fileError) errors.file = fileError;
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    row: {
      evidence_type: type,
      label,
      url,
      text_value: text,
      linked_metric_id: type === 'metric' ? draft.linked_metric_id : null,
      requirement_id: draft.requirement_id || null,
    },
  };
}

/**
 * Uploads files (to the startup's folder in update-attachments) and inserts the rows.
 * If the insert fails, the uploaded files are removed again.
 */
export async function saveEvidenceDrafts(
  startupId: string,
  drafts: readonly EvidenceDraft[],
  context: Pick<EvidenceInsert, 'stage' | 'update_id'>,
): Promise<void> {
  const rows: EvidenceInsert[] = [];
  const uploaded: string[] = [];
  try {
    for (const draft of drafts) {
      const parsed = parseEvidenceDraft(draft);
      if (!parsed.ok) throw new Error(Object.values(parsed.errors)[0] ?? 'Check your evidence.');
      let filePath: string | null = null;
      if (draft.file && needsFile(draft.evidence_type)) {
        filePath = await uploadWithProgress(
          'update-attachments',
          storagePath(startupId, 'evidence', draft.file),
          draft.file,
        );
        uploaded.push(filePath);
      }
      rows.push({ ...parsed.row, ...context, file_path: filePath });
    }
    await addEvidence(startupId, rows);
  } catch (error) {
    await Promise.all(uploaded.map((path) => removeFile('update-attachments', path)));
    throw error;
  }
}
