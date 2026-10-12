import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextareaField } from '@/components/ui/Field';
import { stageName, type StageRequirement } from '@/domain/journey';
import type { ReadinessSection } from '@/domain/readiness';
import type { StageReview } from '@/domain/reviews';
import { adminKeys } from '@/features/admin/keys';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { decideReview, type ReviewDecision } from '../api';

function useDecision(review: StageReview, onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      decision: ReviewDecision;
      feedback?: string;
      adminNote?: string;
      requirementIds?: string[];
      sections?: ReadinessSection[];
    }) => decideReview({ reviewId: review.id, ...input }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.review(review.id) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.reviewQueueAll }),
        queryClient.invalidateQueries({ queryKey: adminKeys.reviewStats }),
        queryClient.invalidateQueries({ queryKey: adminKeys.stageDistribution }),
        queryClient.invalidateQueries({ queryKey: adminKeys.startup(review.startup_id) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.startupsAll }),
        queryClient.invalidateQueries({ queryKey: adminKeys.readinessStats }),
        queryClient.invalidateQueries({ queryKey: founderKeys.reviews(review.startup_id) }),
        queryClient.invalidateQueries({ queryKey: founderKeys.readiness(review.startup_id) }),
      ]),
    onSuccess: (saved) => {
      toast.success(
        saved.status !== 'approved'
          ? 'Sent back to the founder with your feedback.'
          : saved.review_type === 'investor_readiness'
            ? 'Marked Investor Ready. Investor Access is unlocked.'
            : `Approved. The startup is now at ${stageName(saved.to_stage)}.`,
      );
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save this decision.")),
  });
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: StageReview;
  startupName: string;
}

export function ApproveDialog(props: DialogProps) {
  return props.open ? <ApproveForm {...props} /> : null;
}

function ApproveForm({ open, onOpenChange, review, startupName }: DialogProps) {
  const [note, setNote] = useState('');
  const decision = useDecision(review, () => onOpenChange(false));
  const from = stageName(review.from_stage);
  const to = stageName(review.to_stage);
  const readiness = review.review_type === 'investor_readiness';
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !decision.isPending && onOpenChange(next)}
      title={readiness ? 'Mark Investor Ready?' : `Approve ${from} stage?`}
      description={
        readiness
          ? `This confirms ${startupName} is Investor Ready and unlocks Investor Access. It cannot be undone.`
          : `This will move ${startupName} from ${from} to ${to}.`
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={decision.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => decision.mutate({ decision: 'approved', adminNote: note })}
            loading={decision.isPending}
          >
            {readiness ? 'Mark Investor Ready' : <>Approve &amp; Move to {to}</>}
          </Button>
        </>
      }
    >
      <TextareaField
        label="Note to the founder"
        hint="Optional. Shown with the approval in the founder's review history."
        rows={3}
        maxLength={4000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    </Dialog>
  );
}

type NeedsWorkProps = DialogProps & {
  requirements: readonly Pick<StageRequirement, 'id' | 'title'>[];
  /** Investor Readiness: sections the admin can flag. */
  sections?: readonly { key: ReadinessSection; name: string }[];
};

export function NeedsWorkDialog(props: NeedsWorkProps) {
  return props.open ? <NeedsWorkForm {...props} /> : null;
}

function NeedsWorkForm({
  open,
  onOpenChange,
  review,
  requirements,
  sections = [],
}: NeedsWorkProps) {
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [flagged, setFlagged] = useState<ReadinessSection[]>([]);
  const readiness = review.review_type === 'investor_readiness';
  const [error, setError] = useState<string | null>(null);
  const decision = useDecision(review, () => onOpenChange(false));

  const submit = () => {
    if (!feedback.trim()) {
      setError('Tell the founder what needs improvement.');
      return;
    }
    setError(null);
    decision.mutate({
      decision: 'needs_work',
      feedback,
      requirementIds: selected,
      sections: readiness ? flagged : [],
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !decision.isPending && onOpenChange(next)}
      size="lg"
      title="Send back to founder"
      description={`The startup stays at ${stageName(review.from_stage)}. The founder sees your feedback and can resubmit.`}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={decision.isPending}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={decision.isPending}>
            Send Back to Founder
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
        <TextareaField
          label="What needs improvement?"
          required
          rows={4}
          maxLength={4000}
          placeholder={
            readiness
              ? 'e.g. Add a financial model and a clearer use of funds before investor introductions.'
              : 'e.g. You need stronger customer validation evidence before moving to MVP.'
          }
          value={feedback}
          error={error ?? undefined}
          onChange={(event) => setFeedback(event.target.value)}
        />
        {readiness && sections.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium text-ink">
              Sections that need attention{' '}
              <span className="font-normal text-muted">(optional)</span>
            </legend>
            <ul className="grid gap-1.5 sm:grid-cols-3">
              {sections.map((section) => (
                <li key={section.key}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={flagged.includes(section.key)}
                      onChange={() =>
                        setFlagged((keys) =>
                          keys.includes(section.key)
                            ? keys.filter((key) => key !== section.key)
                            : [...keys, section.key],
                        )
                      }
                    />
                    {section.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        {requirements.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium text-ink">
              Requirements that need attention{' '}
              <span className="font-normal text-muted">(optional)</span>
            </legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {requirements.map((row) => (
                <li key={row.id}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selected.includes(row.id)}
                      onChange={() =>
                        setSelected((ids) =>
                          ids.includes(row.id)
                            ? ids.filter((id) => id !== row.id)
                            : [...ids, row.id],
                        )
                      }
                    />
                    {row.title}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </form>
    </Dialog>
  );
}
