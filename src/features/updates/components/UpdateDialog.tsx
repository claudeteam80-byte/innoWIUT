import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { paths } from '@/app/paths';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { formatMetricValue } from '@/domain/format';
import {
  JOURNEY_STAGES,
  PROGRESS_TYPES,
  evidenceTypeLabel,
  metricMovement,
  stageRequirements,
  type EvidenceType,
  type ProgressType,
  type StageEvidence,
  type StageKey,
} from '@/domain/journey';
import { describeMetricChange } from '@/domain/traction';
import { founderKeys } from '@/features/founder-keys';
import { addEvidence, deleteEvidence } from '@/features/journey/api';
import { EvidenceFields } from '@/features/journey/components/EvidenceFields';
import {
  emptyEvidence,
  parseEvidenceDraft,
  saveEvidenceDrafts,
  type EvidenceDraft,
  type EvidenceErrors,
} from '@/features/journey/evidence';
import { useEvidence, useRequirements } from '@/features/journey/hooks';
import { useMyStartup } from '@/features/startup/hooks';
import { ChangePill } from '@/features/traction/components/ChangePill';
import { useEntries, useMetrics } from '@/features/traction/hooks';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { createUpdate, editUpdate, publishDraft, type StartupUpdate } from '../api';
import {
  buildUpdateRow,
  updateSchemaFor,
  type UpdateAction,
  type UpdateFormValues,
} from '../schemas';

/** Evidence types offered in the composer; numbers are linked in "Traction movement". */
const COMPOSER_EVIDENCE_TYPES: EvidenceType[] = [
  'link',
  'product_url',
  'screenshot',
  'document',
  'customer_feedback',
  'text_note',
];
const OPEN_STAGES = JOURNEY_STAGES.filter((stage) => !stage.locked);

const defaultTitle = () =>
  `Weekly Update — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

function valuesFrom(
  update: StartupUpdate | null | undefined,
  stage: StageKey | null,
): UpdateFormValues {
  return {
    title: update?.title ?? defaultTitle(),
    summary: update?.summary ?? '',
    progress_types: (update?.progress_types ?? []) as ProgressType[],
    blocker: update?.blocker ?? '',
    next_milestone: update?.next_milestone ?? '',
    next_milestone_date: update?.next_milestone_date ?? '',
    linked_stage: (update ? update.linked_stage : stage) ?? '',
  } as UpdateFormValues;
}

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  /** Draft being edited; omit to create a new update. */
  update?: StartupUpdate | null;
  /** Stage a new update starts linked to (defaults to the startup's current stage). */
  defaultStage?: StageKey;
}

export function UpdateDialog(props: UpdateDialogProps) {
  // Remount per update so the form starts from that update's values.
  return props.open ? <UpdateForm key={props.update?.id ?? 'new'} {...props} /> : null;
}

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          {number} · {title}
        </h3>
        {description && <p className="mt-1 text-[12.5px] text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function UpdateForm({ open, onOpenChange, startupId, update, defaultStage }: UpdateDialogProps) {
  const queryClient = useQueryClient();
  const startup = useMyStartup();
  const requirements = useRequirements(startupId);
  const metrics = useMetrics(startupId);
  const entries = useEntries(startupId);
  const evidence = useEvidence(startupId);
  const currentStage = startup.data?.journey_stage ?? null;

  const action = useRef<UpdateAction>('draft');
  // Id of the row once saved, so a retry after a partial failure never creates a duplicate.
  const [savedId, setSavedId] = useState<string | null>(update?.id ?? null);
  const existing = (evidence.data ?? []).filter(
    (item) => savedId !== null && item.update_id === savedId,
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<EvidenceDraft[]>([]);
  const [draftErrors, setDraftErrors] = useState<EvidenceErrors[]>([]);
  const [linkedMetrics, setLinkedMetrics] = useState<string[] | null>(null);
  const metricList = metrics.data ?? [];
  const chosenMetrics =
    linkedMetrics ??
    existing.filter((e) => e.evidence_type === 'metric').map((e) => e.linked_metric_id as string);

  const resolver: Resolver<UpdateFormValues> = (values, context, options) => {
    const validate = zodResolver(updateSchemaFor(action.current), undefined, {
      raw: true,
    }) as unknown as Resolver<UpdateFormValues>;
    return validate(values, context, options);
  };
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UpdateFormValues>({
    resolver,
    defaultValues: valuesFrom(update, defaultStage ?? currentStage),
  });
  const progressTypes = useWatch({ control, name: 'progress_types' });
  const linkedStage = (useWatch({ control, name: 'linked_stage' }) || null) as StageKey | null;
  const stageOptions = stageRequirements(linkedStage ?? 'idea', requirements.data ?? []).map(
    (r) => ({
      id: r.id,
      title: r.title,
    }),
  );

  const toggleType = (type: ProgressType) =>
    setValue(
      'progress_types',
      progressTypes.includes(type)
        ? progressTypes.filter((t) => t !== type)
        : [...progressTypes, type],
      { shouldDirty: true, shouldValidate: Boolean(errors.progress_types) },
    );

  const mutation = useMutation({
    mutationFn: async ({ values, mode }: { values: UpdateFormValues; mode: UpdateAction }) => {
      const row = buildUpdateRow(values, mode);
      // Save as a draft first, attach the proof, then publish — an update never goes out
      // without the evidence the founder added.
      const draftRow = { ...row, status: 'draft' as const };
      const saved = savedId
        ? await editUpdate(savedId, draftRow)
        : await createUpdate(startupId, draftRow);
      setSavedId(saved.id);

      const stage = row.linked_stage ?? currentStage ?? 'idea';
      const validIds = new Set(stageRequirements(stage, requirements.data ?? []).map((r) => r.id));
      const toRemove = existing.filter(
        (item) =>
          removed.includes(item.id) ||
          (item.evidence_type === 'metric' && !chosenMetrics.includes(item.linked_metric_id ?? '')),
      );
      await deleteEvidence(toRemove);
      await saveEvidenceDrafts(
        startupId,
        drafts.map((d) => (validIds.has(d.requirement_id) ? d : { ...d, requirement_id: '' })),
        { stage, update_id: saved.id },
      );
      setDrafts([]);
      const alreadyLinked = existing
        .filter((e) => e.evidence_type === 'metric' && !toRemove.includes(e))
        .map((e) => e.linked_metric_id);
      await addEvidence(
        startupId,
        chosenMetrics
          .filter((id) => !alreadyLinked.includes(id))
          .map((id) => ({
            stage,
            update_id: saved.id,
            evidence_type: 'metric' as const,
            label: metricList.find((m) => m.id === id)?.name ?? 'Traction metric',
            linked_metric_id: id,
          })),
      );
      if (mode === 'publish') await publishDraft(saved.id);
      return mode;
    },
    onSuccess: async (mode) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: founderKeys.updates(startupId) }),
        queryClient.invalidateQueries({ queryKey: founderKeys.evidence(startupId) }),
      ]);
      toast.success(
        mode === 'publish'
          ? 'Update published. innoWIUT can see the progress you have proven.'
          : 'Draft saved. You can finish it later from your updates page.',
      );
      onOpenChange(false);
    },
    onError: async (error) => {
      // Whatever was saved before the failure is shown; the dialog stays open to retry.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: founderKeys.updates(startupId) }),
        queryClient.invalidateQueries({ queryKey: founderKeys.evidence(startupId) }),
      ]);
      toast.error(errorMessage(error, "We couldn't save your update. Please try again."));
    },
  });

  const submit = (mode: UpdateAction) => {
    action.current = mode;
    const parsed = drafts.map(parseEvidenceDraft);
    const nextErrors = parsed.map((p) => (p.ok ? {} : p.errors));
    setDraftErrors(nextErrors);
    void handleSubmit((values) => {
      if (parsed.some((p) => !p.ok)) return;
      mutation.mutate({ values, mode });
    })();
  };

  const busy = mutation.isPending;
  const shownExisting = existing.filter(
    (item) => item.evidence_type !== 'metric' && !removed.includes(item.id),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      size="lg"
      title={update ? 'Edit draft' : 'New update'}
      description="Prove progress: what changed, what backs it up, what is next."
      footer={
        <>
          <Button variant="outline" onClick={() => submit('draft')} disabled={busy}>
            Save Draft
          </Button>
          <Button
            onClick={() => submit('publish')}
            loading={busy && mutation.variables?.mode === 'publish'}
            disabled={busy}
          >
            Publish Update
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
        <Step number={1} title="What moved?">
          <TextField
            label="Headline"
            required
            error={errors.title?.message}
            {...register('title')}
          />
          <TextareaField
            label="What meaningfully changed since your last update?"
            required
            rows={4}
            placeholder="We launched the new onboarding flow and tested it with 20 new users."
            hint="Required to publish."
            error={errors.summary?.message}
            {...register('summary')}
          />
        </Step>

        <Step
          number={2}
          title="Progress type"
          description="Required to publish. Choose all that apply."
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="Progress type">
            {PROGRESS_TYPES.map((type) => {
              const selected = progressTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleType(type)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition',
                    selected
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-line bg-white text-muted hover:border-primary/40 hover:text-ink',
                  )}
                >
                  {type}
                </button>
              );
            })}
          </div>
          {errors.progress_types?.message && (
            <p className="text-[12px] text-danger">{errors.progress_types.message}</p>
          )}
        </Step>

        <Step number={3} title="Evidence" description="What proves this progress? Optional.">
          {shownExisting.length > 0 && (
            <ul className="space-y-2">
              {shownExisting.map((item: StageEvidence) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas-subtle px-3 py-2 text-[13px]"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-muted">{evidenceTypeLabel(item.evidence_type)} · </span>
                    {item.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove evidence ${item.label}`}
                    onClick={() => setRemoved((ids) => [...ids, item.id])}
                    disabled={busy}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {drafts.map((draft, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-ink">New evidence {index + 1}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove new evidence ${index + 1}`}
                  onClick={() => {
                    setDrafts((list) => list.filter((_, i) => i !== index));
                    setDraftErrors((list) => list.filter((_, i) => i !== index));
                  }}
                  disabled={busy}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <EvidenceFields
                value={draft}
                onChange={(next) =>
                  setDrafts((list) => list.map((d, i) => (i === index ? next : d)))
                }
                errors={draftErrors[index]}
                types={COMPOSER_EVIDENCE_TYPES}
                requirements={stageOptions}
                disabled={busy}
              />
            </div>
          ))}
          {drafts.length + shownExisting.length < 10 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrafts((list) => [...list, emptyEvidence('link')])}
              disabled={busy}
            >
              <Plus aria-hidden="true" /> Add evidence
            </Button>
          )}
        </Step>

        <Step
          number={4}
          title="Traction movement"
          description="Link the numbers that moved. The change is read from your traction history."
        >
          {metricList.length === 0 ? (
            <p className="rounded-lg bg-canvas-subtle px-3.5 py-3 text-[12.5px] text-muted">
              No traction metrics tracked yet.{' '}
              <Link
                to={paths.founder.traction}
                className="font-medium text-primary hover:underline"
              >
                Add metrics on the Traction page
              </Link>{' '}
              — next time you can link the movement here.
            </p>
          ) : (
            <ul className="space-y-2">
              {metricList.map((metric) => {
                const checked = chosenMetrics.includes(metric.id);
                const move = metricMovement(entries.data ?? [], metric.id);
                const format = (value: number | null) =>
                  formatMetricValue(value, metric.unit, metric.currency);
                return (
                  <li key={metric.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5',
                        checked ? 'border-primary/50 bg-primary-soft/40' : 'border-line bg-white',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={checked}
                        disabled={busy}
                        onChange={() =>
                          setLinkedMetrics(
                            checked
                              ? chosenMetrics.filter((id) => id !== metric.id)
                              : [...chosenMetrics, metric.id],
                          )
                        }
                      />
                      <span className="text-[13px] font-semibold text-ink">{metric.name}</span>
                      <span className="text-[12.5px] text-muted">
                        {move.current === null
                          ? 'No values recorded yet'
                          : `${format(move.previous)} → ${format(move.current)}`}
                      </span>
                      <ChangePill change={describeMetricChange(move.previous, move.current)} />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Step>

        <Step number={5} title="Blocker">
          <TextareaField
            label="What is currently slowing you down?"
            hint="Optional"
            rows={2}
            error={errors.blocker?.message}
            {...register('blocker')}
          />
          {update?.challenge && (
            <p className="rounded-lg bg-canvas-subtle px-3 py-2 text-[12.5px] text-muted">
              Earlier challenge on this draft (kept as written): {update.challenge}
            </p>
          )}
        </Step>

        <Step number={6} title="Next milestone">
          <TextField
            label="What specific outcome are you aiming for next?"
            hint="Optional"
            placeholder="Reach 1,000 active users"
            error={errors.next_milestone?.message}
            {...register('next_milestone')}
          />
          <TextField
            label="Target date"
            hint="Optional"
            type="date"
            className="sm:w-56"
            error={errors.next_milestone_date?.message}
            {...register('next_milestone_date')}
          />
          {update?.next_steps && (
            <p className="rounded-lg bg-canvas-subtle px-3 py-2 text-[12.5px] text-muted">
              Earlier next steps on this draft (kept as written): {update.next_steps}
            </p>
          )}
        </Step>

        <Step
          number={7}
          title="Linked stage"
          description="Which part of your journey does this prove?"
        >
          <SelectField
            label="Linked stage"
            className="sm:w-64"
            placeholder="Not linked to a stage"
            options={OPEN_STAGES.map((stage) => ({ value: stage.key, label: stage.name }))}
            error={errors.linked_stage?.message}
            {...register('linked_stage')}
          />
        </Step>
      </form>
    </Dialog>
  );
}
