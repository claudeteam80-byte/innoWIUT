import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import type { InterviewStatus } from '@/domain/readiness';
import { adminKeys } from '@/features/admin/keys';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { setInterview, type AdminInterview } from '../api';
import { parseInterview, toLocalInput } from '../ui-helpers';

const STATUS_OPTIONS: { value: InterviewStatus; label: string }[] = [
  { value: 'not_required', label: 'Not required' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  startupName: string;
  interview: AdminInterview | null;
}

export function InterviewDialog(props: Props) {
  return props.open ? <InterviewForm {...props} /> : null;
}

/** Admin-only. The founder sees date, time, place and status — never the admin note. */
function InterviewForm({ open, onOpenChange, startupId, startupName, interview }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<InterviewStatus>(
    interview?.status && interview.status !== 'not_required' ? interview.status : 'scheduled',
  );
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(interview?.scheduled_at));
  const [location, setLocation] = useState(interview?.location_or_link ?? '');
  const [note, setNote] = useState(interview?.admin_note ?? '');
  const [errors, setErrors] = useState<
    Partial<Record<'scheduledAt' | 'location' | 'note', string>>
  >({});

  const save = useMutation({
    mutationFn: (input: Parameters<typeof setInterview>[0]) => setInterview(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.interview(startupId) }),
        queryClient.invalidateQueries({ queryKey: founderKeys.readiness(startupId) }),
      ]);
      toast.success('Interview saved.');
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save the interview.")),
  });

  const submit = () => {
    const parsed = parseInterview({ status, scheduledAt, location, note });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    save.mutate({
      startupId,
      status,
      scheduledAt: parsed.scheduledAt,
      locationOrLink: parsed.location,
      adminNote: parsed.note,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title="Readiness interview"
      description={`Optional. ${startupName} sees the date, time, place and status only.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Save Interview
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
          onChange={(event) => setStatus(event.target.value as InterviewStatus)}
          options={STATUS_OPTIONS}
        />
        {status !== 'not_required' && (
          <>
            <TextField
              label="Date and time"
              type="datetime-local"
              required
              value={scheduledAt}
              error={errors.scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <TextField
              label="Location or meeting link"
              required
              maxLength={500}
              placeholder="e.g. innoWIUT office, room 204 — or a meeting link"
              value={location}
              error={errors.location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </>
        )}
        <TextareaField
          label="Admin note"
          hint="Visible to innoWIUT admins only."
          maxLength={2000}
          value={note}
          error={errors.note}
          onChange={(event) => setNote(event.target.value)}
        />
      </form>
    </Dialog>
  );
}
