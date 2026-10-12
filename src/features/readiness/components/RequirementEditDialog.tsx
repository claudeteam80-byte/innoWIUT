import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { optionalUrl } from '@/domain/form-fields';
import { stageName, type StageEvidence } from '@/domain/journey';
import type { ReadinessRequirement, ReadinessStateRow } from '@/domain/readiness';
import { founderKeys } from '@/features/founder-keys';
import { deleteEvidence } from '@/features/journey/api';
import { EvidenceFields } from '@/features/journey/components/EvidenceFields';
import { EvidenceList } from '@/features/journey/components/EvidenceList';
import {
  emptyEvidence,
  parseEvidenceDraft,
  saveEvidenceDrafts,
  type EvidenceDraft,
  type EvidenceErrors,
} from '@/features/journey/evidence';
import { errorMessage } from '@/lib/errors';
import { updateReadinessRequirement } from '../api';
import { readinessEvidenceFor, reusableEvidence } from '../values';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  row: ReadinessStateRow | null;
  requirement: ReadinessRequirement | null;
  evidence: readonly StageEvidence[];
}

const urlField = optionalUrl('Enter a valid link, e.g. https://example.com.');

export function RequirementEditDialog(props: Props) {
  return props.open && props.row && props.requirement ? (
    <RequirementForm key={props.row.requirement_id} {...props} />
  ) : null;
}

function RequirementForm({ open, onOpenChange, startupId, row, requirement, evidence }: Props) {
  const queryClient = useQueryClient();
  const req = requirement!;
  const kind = row!.input_kind;
  const allowsText = kind === 'text' || kind === 'text_or_evidence';
  const allowsEvidence = kind === 'link_or_file' || kind === 'text_or_evidence';
  const [textValue, setTextValue] = useState(req.text_value ?? '');
  const [url, setUrl] = useState(req.url ?? '');
  const [linked, setLinked] = useState(req.linked_existing_evidence_id ?? '');
  const [notApplicable, setNotApplicable] = useState(req.not_applicable);
  const [reason, setReason] = useState(req.not_applicable_reason ?? '');
  const [errors, setErrors] = useState<{ url?: string; reason?: string; text?: string }>({});
  const [draft, setDraft] = useState<EvidenceDraft | null>(null);
  const [draftErrors, setDraftErrors] = useState<EvidenceErrors>({});
  const attached = readinessEvidenceFor(req.id, evidence);
  const reusable = reusableEvidence(evidence);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: founderKeys.readiness(startupId) }),
      queryClient.invalidateQueries({ queryKey: founderKeys.evidence(startupId) }),
    ]);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateReadinessRequirement>[1]) =>
      updateReadinessRequirement(req.id, patch),
    onSuccess: async () => {
      await refresh();
      toast.success(`${req.title} saved.`);
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save this requirement.")),
  });

  const addEvidence = useMutation({
    mutationFn: (value: EvidenceDraft) =>
      saveEvidenceDrafts(startupId, [value], {
        stage: 'investor_readiness',
        update_id: null,
        readiness_requirement_id: req.id,
      }),
    onSuccess: async () => {
      await refresh();
      setDraft(null);
      toast.success('Evidence added.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save this evidence.")),
  });

  const remove = useMutation({
    mutationFn: (item: StageEvidence) => deleteEvidence([item]),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error, "We couldn't remove this evidence.")),
  });

  const submit = () => {
    const next: typeof errors = {};
    const parsedUrl = urlField.safeParse(url);
    if (!parsedUrl.success) next.url = parsedUrl.error.issues[0]?.message;
    if (textValue.trim().length > 4000) next.text = 'Use 4000 characters or fewer.';
    if (notApplicable && reason.trim().length < 3) next.reason = 'Add a short reason.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({
      text_value: allowsText ? textValue.trim() || null : req.text_value,
      url: allowsEvidence && parsedUrl.success ? parsedUrl.data : req.url,
      linked_existing_evidence_id: allowsEvidence
        ? linked || null
        : req.linked_existing_evidence_id,
      not_applicable: notApplicable,
      not_applicable_reason: notApplicable ? reason.trim() : null,
    });
  };

  const submitEvidence = () => {
    if (!draft) return;
    const parsed = parseEvidenceDraft(draft);
    if (!parsed.ok) {
      setDraftErrors(parsed.errors);
      return;
    }
    setDraftErrors({});
    addEvidence.mutate(draft);
  };

  const busy = save.isPending || addEvidence.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={req.title}
      description={row!.description}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending} disabled={addEvidence.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {row!.allows_not_applicable && (
          <div className="space-y-2 rounded-lg bg-canvas-subtle px-4 py-3">
            <CheckboxField
              label="Not applicable to my startup"
              checked={notApplicable}
              onChange={(event) => setNotApplicable(event.target.checked)}
            />
            {notApplicable && (
              <TextField
                label="Why it does not apply"
                required
                maxLength={500}
                value={reason}
                error={errors.reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </div>
        )}

        {!notApplicable && (
          <>
            {allowsText && (
              <TextareaField
                label="Your answer"
                rows={4}
                maxLength={4000}
                value={textValue}
                error={errors.text}
                onChange={(event) => setTextValue(event.target.value)}
              />
            )}
            {allowsEvidence && (
              <>
                <TextField
                  label="Link"
                  hint="A link an investor can open (deck, video, folder…)."
                  inputMode="url"
                  placeholder="https://"
                  value={url}
                  error={errors.url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                {reusable.length > 0 && (
                  <SelectField
                    label="Or reuse evidence from your journey"
                    placeholder="None"
                    value={linked}
                    onChange={(event) => setLinked(event.target.value)}
                    options={reusable.map((e) => ({
                      value: e.id,
                      label: `${e.label} (${stageName(e.stage)})`,
                    }))}
                  />
                )}
              </>
            )}
          </>
        )}
      </form>

      {allowsEvidence && !notApplicable && (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-ink">Files and evidence</p>
            {!draft && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(emptyEvidence('document'))}
              >
                <Plus aria-hidden="true" /> Add File or Link
              </Button>
            )}
          </div>
          {attached.length === 0 && !draft && (
            <p className="text-[12.5px] text-muted">No files attached yet.</p>
          )}
          <EvidenceList
            items={attached}
            onDelete={(item) => remove.mutate(item)}
            deletingId={remove.isPending ? (remove.variables?.id ?? null) : null}
          />
          {draft && (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <EvidenceFields
                value={draft}
                onChange={setDraft}
                errors={draftErrors}
                types={['document', 'screenshot', 'link', 'product_url']}
                evidenceHint={req.title}
                disabled={addEvidence.isPending}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft(null)}
                  disabled={addEvidence.isPending}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={submitEvidence} loading={addEvidence.isPending}>
                  Add Evidence
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
