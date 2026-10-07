import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { saveTeamMember, type TeamMember } from '../api';
import { teamMemberSchema, type TeamMemberInput } from '../schemas';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  member: TeamMember | null;
}

export function TeamMemberDialog(props: Props) {
  return props.open ? <TeamMemberForm key={props.member?.id ?? 'new'} {...props} /> : null;
}

function TeamMemberForm({ open, onOpenChange, startupId, member }: Props) {
  const queryClient = useQueryClient();
  const defaults: TeamMemberInput = {
    name: member?.name ?? '',
    role: member?.role ?? '',
    email: member?.email ?? '',
    linkedin_url: member?.linkedin_url ?? '',
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(teamMemberSchema), defaultValues: defaults });

  const mutation = useMutation({
    mutationFn: handleSubmitValues,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.team(startupId) });
      toast.success(member ? 'Team member updated.' : 'Team member added.');
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save this team member.")),
  });

  function handleSubmitValues(values: Parameters<typeof saveTeamMember>[1]) {
    return saveTeamMember(startupId, values, member?.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? 'Edit team member' : 'Add team member'}
      description="Team members are listed on your startup profile. They do not get an account."
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="team-member-form" loading={mutation.isPending}>
            {member ? 'Save Changes' : 'Add Team Member'}
          </Button>
        </>
      }
    >
      <form
        id="team-member-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="space-y-4"
      >
        <TextField
          label="Name"
          required
          autoComplete="off"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Role"
          hint="Optional"
          placeholder="e.g. Head of Product"
          error={errors.role?.message}
          {...register('role')}
        />
        <TextField
          label="Email"
          hint="Optional"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="LinkedIn"
          hint="Optional"
          inputMode="url"
          error={errors.linkedin_url?.message}
          {...register('linkedin_url')}
        />
      </form>
    </Dialog>
  );
}
