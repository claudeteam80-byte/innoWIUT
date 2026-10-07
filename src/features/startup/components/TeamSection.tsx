import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Mail, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { deleteTeamMember, type TeamMember } from '../api';
import { useTeam } from '../hooks';
import { TeamMemberDialog } from './TeamMemberDialog';

export function TeamSection({ startupId }: { startupId: string }) {
  const queryClient = useQueryClient();
  const team = useTeam(startupId);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<TeamMember | null>(null);

  const remove = useMutation({
    mutationFn: (member: TeamMember) => deleteTeamMember(member.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.team(startupId) });
      setDeleting(null);
      toast.success('Team member removed.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't remove this team member.")),
  });

  const openDialog = (member: TeamMember | null) => {
    setEditing(member);
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader
        title="Team"
        description="The people building your startup."
        action={
          <Button variant="outline" size="sm" onClick={() => openDialog(null)}>
            <Plus aria-hidden="true" /> Add Team Member
          </Button>
        }
      />
      {team.isError ? (
        <ErrorState onRetry={() => void team.refetch()} />
      ) : team.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : team.data.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg bg-canvas px-4 py-8 text-center">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="mt-2 text-[13.5px] font-medium text-ink">No team members yet</p>
          <p className="mt-1 text-[12.5px] text-muted">
            Add your co-founders and teammates so innoWIUT knows who is building.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {team.data.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              <Avatar name={member.name} size="sm" shape="circle" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink">{member.name}</p>
                <p className="truncate text-[12.5px] text-muted">{member.role || 'Team member'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink"
                    aria-label={`Email ${member.name}`}
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                )}
                {member.linkedin_url && (
                  <a
                    href={member.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink"
                    aria-label={`${member.name} on LinkedIn`}
                  >
                    <Link2 className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => openDialog(member)}
                  className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink"
                  aria-label={`Edit ${member.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(member)}
                  className="rounded-md p-2 text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label={`Remove ${member.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <TeamMemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        startupId={startupId}
        member={editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove ${deleting?.name ?? 'team member'}?`}
        description="They will be removed from your startup profile."
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </Card>
  );
}
