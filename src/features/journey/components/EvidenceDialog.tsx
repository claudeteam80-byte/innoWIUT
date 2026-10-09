import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { templateFor, type StageKey, type StageRequirement } from '@/domain/journey';
import { founderKeys } from '@/features/founder-keys';
import type { Metric } from '@/features/traction/api';
import { errorMessage } from '@/lib/errors';
import {
  emptyEvidence,
  parseEvidenceDraft,
  saveEvidenceDrafts,
  type EvidenceDraft,
  type EvidenceErrors,
} from '../evidence';
import { EvidenceFields } from './EvidenceFields';

interface EvidenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  stage: StageKey;
  requirements: readonly StageRequirement[];
  metrics: readonly Metric[];
  /** Requirement the evidence starts linked to. */
  requirement?: StageRequirement | null;
}

export function EvidenceDialog(props: EvidenceDialogProps) {
  return props.open ? <EvidenceForm key={props.requirement?.id ?? 'stage'} {...props} /> : null;
}

function EvidenceForm({
  open,
  onOpenChange,
  startupId,
  stage,
  requirements,
  metrics,
  requirement,
}: EvidenceDialogProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EvidenceDraft>(() =>
    emptyEvidence(stage === 'traction' ? 'metric' : 'link', requirement?.id ?? ''),
  );
  const [errors, setErrors] = useState<EvidenceErrors>({});
  const hint = requirement ? templateFor(requirement)?.evidenceHint : undefined;

  const save = useMutation({
    mutationFn: () => saveEvidenceDrafts(startupId, [draft], { stage, update_id: null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.evidence(startupId) });
      toast.success('Evidence added. innoWIUT can see it on your journey.');
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save this evidence.")),
  });

  const submit = () => {
    const parsed = parseEvidenceDraft(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    save.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title="Add evidence"
      description={
        hint
          ? `Add what proves this — ${hint.toLowerCase()}.`
          : 'Add what proves this — a link, screenshot, document, metric or feedback.'
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Add Evidence
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <EvidenceFields
          value={draft}
          onChange={setDraft}
          errors={errors}
          metrics={metrics}
          requirements={requirements.map((r) => ({ id: r.id, title: r.title }))}
          evidenceHint={hint}
          disabled={save.isPending}
        />
      </form>
    </Dialog>
  );
}
