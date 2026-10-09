import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import {
  REQUIREMENT_STATUSES,
  templateFor,
  type RequirementStatus,
  type StageRequirement,
} from '@/domain/journey';
import { founderKeys } from '@/features/founder-keys';
import type { Metric } from '@/features/traction/api';
import { errorMessage } from '@/lib/errors';
import { updateRequirement } from '../api';

interface RequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  requirement: StageRequirement | null;
  metrics: readonly Metric[];
}

export function RequirementDialog(props: RequirementDialogProps) {
  return props.open && props.requirement ? (
    <RequirementForm key={props.requirement.id} {...props} requirement={props.requirement} />
  ) : null;
}

function RequirementForm({
  open,
  onOpenChange,
  startupId,
  requirement,
  metrics,
}: RequirementDialogProps & { requirement: StageRequirement }) {
  const queryClient = useQueryClient();
  const template = templateFor(requirement);
  const [status, setStatus] = useState<RequirementStatus>(requirement.status);
  const [progress, setProgress] = useState(
    requirement.progress_value === null ? '' : String(requirement.progress_value),
  );
  const [metricId, setMetricId] = useState(requirement.linked_metric_id ?? '');
  const [progressError, setProgressError] = useState<string | null>(null);
  const isTraction = requirement.stage === 'traction';
  const hasTarget = requirement.progress_target !== null;

  const save = useMutation({
    mutationFn: (value: number | null) =>
      updateRequirement(requirement.id, {
        status,
        ...(hasTarget ? { progress_value: value } : {}),
        ...(isTraction ? { linked_metric_id: metricId || null } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.requirements(startupId) });
      toast.success(`${requirement.title} updated.`);
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save this requirement.")),
  });

  const submit = () => {
    let value: number | null = null;
    if (hasTarget && progress.trim() !== '') {
      value = Number(progress);
      if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        setProgressError('Use a whole number of 0 or more.');
        return;
      }
    }
    setProgressError(null);
    save.mutate(value);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={requirement.title}
      description={template?.hint ?? requirement.description ?? undefined}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Save Progress
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
        <SelectField
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as RequirementStatus)}
          options={REQUIREMENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
          hint="Completing every requirement does not change your stage — stage moves are reviewed by innoWIUT."
        />
        {hasTarget && (
          <TextField
            label={`Progress (target ${requirement.progress_target} ${template?.targetLabel ?? ''})`.trim()}
            inputMode="numeric"
            value={progress}
            error={progressError ?? undefined}
            onChange={(event) => setProgress(event.target.value)}
          />
        )}
        {isTraction && (
          <SelectField
            label="Linked traction metric"
            placeholder="Not linked"
            value={metricId}
            onChange={(event) => setMetricId(event.target.value)}
            options={metrics.map((m) => ({ value: m.id, label: m.name }))}
            hint="Values come from your traction history — record new numbers on the Traction page."
          />
        )}
      </form>
    </Dialog>
  );
}
