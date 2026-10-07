import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { localToday } from '@/domain/form-fields';
import { MEETING_REASONS } from '@/domain/options';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { createMeetingRequest } from '../api';
import { meetingRequestSchema, type MeetingRequestInput } from '../schemas';

const defaults: MeetingRequestInput = { reason: '' as never, message: '', preferred_date: '' };

export function MeetingRequestDialog({
  open,
  onOpenChange,
  startupId,
  mentorId,
  mentorName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  mentorId: string;
  mentorName: string;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(meetingRequestSchema), defaultValues: defaults });

  const mutation = useMutation({
    mutationFn: (values: {
      reason: string;
      message: string | null;
      preferred_date: string | null;
    }) => createMeetingRequest(startupId, mentorId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.meetings(startupId) });
      toast.success('Meeting requested. The innoWIUT team will confirm it with your mentor.');
      reset(defaults);
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't send your request.")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset(defaults);
        onOpenChange(next);
      }}
      title="Request a meeting"
      description={`Tell ${mentorName} what you would like to work through.`}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="meeting-request-form" loading={mutation.isPending}>
            Request Meeting
          </Button>
        </>
      }
    >
      <form
        id="meeting-request-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="space-y-4"
      >
        <SelectField
          label="Reason"
          required
          placeholder="Select a reason"
          options={MEETING_REASONS}
          error={errors.reason?.message}
          {...register('reason')}
        />
        <TextareaField
          label="Message"
          hint="Optional"
          rows={4}
          error={errors.message?.message}
          {...register('message')}
        />
        <TextField
          label="Preferred date"
          hint="Optional"
          type="date"
          min={localToday()}
          error={errors.preferred_date?.message}
          {...register('preferred_date')}
        />
      </form>
    </Dialog>
  );
}
