import { useId } from 'react';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { EVIDENCE_TYPES, type EvidenceType } from '@/domain/journey';
import type { Metric } from '@/features/traction/api';
import { EVIDENCE_DOCUMENT_TYPES, ALLOWED_IMAGE_TYPES } from '@/lib/storage';
import {
  needsFile,
  needsText,
  needsUrl,
  type EvidenceDraft,
  type EvidenceErrors,
} from '../evidence';

interface EvidenceFieldsProps {
  value: EvidenceDraft;
  onChange: (next: EvidenceDraft) => void;
  errors?: EvidenceErrors;
  metrics?: readonly Metric[];
  /** Requirements the evidence can prove (optional link). */
  requirements?: readonly { id: string; title: string }[];
  /** Evidence types offered; metric evidence is left out where traction is linked separately. */
  types?: readonly EvidenceType[];
  evidenceHint?: string;
  disabled?: boolean;
}

export function EvidenceFields({
  value,
  onChange,
  errors = {},
  metrics = [],
  requirements,
  types = EVIDENCE_TYPES.map((t) => t.value),
  evidenceHint,
  disabled,
}: EvidenceFieldsProps) {
  const fileId = useId();
  const set = (patch: Partial<EvidenceDraft>) => onChange({ ...value, ...patch });
  const type = value.evidence_type;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        label="Evidence type"
        value={type}
        disabled={disabled}
        onChange={(event) => set({ evidence_type: event.target.value as EvidenceType, file: null })}
        options={EVIDENCE_TYPES.filter((t) => types.includes(t.value))}
      />
      <TextField
        label="Label"
        required
        placeholder={evidenceHint ?? 'e.g. Interview notes, week 2'}
        value={value.label}
        disabled={disabled}
        maxLength={200}
        error={errors.label}
        onChange={(event) => set({ label: event.target.value })}
      />
      {needsUrl(type) && (
        <TextField
          label={type === 'product_url' ? 'Product URL' : 'Link'}
          required
          inputMode="url"
          placeholder="https://"
          className="sm:col-span-2"
          value={value.url}
          disabled={disabled}
          error={errors.url}
          onChange={(event) => set({ url: event.target.value })}
        />
      )}
      {needsText(type) && (
        <TextareaField
          label={type === 'customer_feedback' ? 'What the customer said' : 'Note'}
          required
          rows={3}
          className="sm:col-span-2"
          value={value.text_value}
          disabled={disabled}
          maxLength={2000}
          error={errors.text_value}
          onChange={(event) => set({ text_value: event.target.value })}
        />
      )}
      {type === 'metric' && (
        <SelectField
          label="Traction metric"
          required
          className="sm:col-span-2"
          placeholder={metrics.length ? 'Choose a metric' : 'No traction metrics yet'}
          value={value.linked_metric_id}
          disabled={disabled || metrics.length === 0}
          error={errors.linked_metric_id}
          hint="Links your recorded traction — the numbers stay in Traction."
          onChange={(event) => set({ linked_metric_id: event.target.value })}
          options={metrics.map((m) => ({ value: m.id, label: m.name }))}
        />
      )}
      {needsFile(type) && (
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor={fileId} className="block text-[13px] font-medium text-ink">
            {type === 'screenshot' ? 'Screenshot' : 'Document'}{' '}
            <span className="text-danger">*</span>
          </label>
          <input
            id={fileId}
            type="file"
            disabled={disabled}
            accept={(type === 'screenshot' ? ALLOWED_IMAGE_TYPES : EVIDENCE_DOCUMENT_TYPES).join(
              ',',
            )}
            aria-invalid={errors.file ? true : undefined}
            className="block w-full text-[13px] text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-ink"
            onChange={(event) => set({ file: event.target.files?.[0] ?? null })}
          />
          <p className={errors.file ? 'text-[12px] text-danger' : 'text-[12px] text-muted'}>
            {errors.file ??
              (type === 'screenshot'
                ? 'PNG, JPG or WebP, up to 5 MB.'
                : 'PDF, PNG, JPG or WebP, up to 5 MB.')}
          </p>
        </div>
      )}
      {requirements && requirements.length > 0 && (
        <SelectField
          label="Proves requirement"
          hint="Optional"
          className="sm:col-span-2"
          placeholder="Not linked to a requirement"
          value={value.requirement_id}
          disabled={disabled}
          onChange={(event) => set({ requirement_id: event.target.value })}
          options={requirements.map((r) => ({ value: r.id, label: r.title }))}
        />
      )}
    </div>
  );
}
