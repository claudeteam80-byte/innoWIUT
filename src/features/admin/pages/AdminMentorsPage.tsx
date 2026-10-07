import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { paths } from '@/app/paths';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { inputClasses } from '@/components/ui/TextField';
import { telegramUrl } from '@/domain/contact';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { publicFileUrl, removeFile } from '@/lib/storage';
import { deleteMentor, type MentorWithAssignments } from '../api';
import { MentorDialog } from '../components/MentorDialog';
import { useMentors } from '../hooks';

export function AdminMentorsPage() {
  const queryClient = useQueryClient();
  const mentors = useMentors();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<MentorWithAssignments | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<MentorWithAssignments | null>(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = mentors.data ?? [];
    if (!term) return list;
    return list.filter((m) =>
      [m.name, m.title, m.email, ...m.expertise]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [mentors.data, query]);

  const remove = useMutation({
    mutationFn: async (mentor: MentorWithAssignments) => {
      const result = await deleteMentor(mentor.id);
      if (result === 'deleted') await removeFile('mentor-photos', mentor.photo_path);
      return result;
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      setDeleting(null);
      toast.success(
        result === 'deleted'
          ? 'Mentor deleted.'
          : 'Mentor archived. They have history with startups, so their record is kept.',
      );
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't delete this mentor.")),
  });

  const open = (mentor: MentorWithAssignments | null) => {
    setEditing(mentor);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="innoWIUT"
        title="Mentors"
        subtitle="Every mentor in the ecosystem and the startups they work with."
        actions={
          <Button onClick={() => open(null)}>
            <Plus aria-hidden="true" /> Create Mentor
          </Button>
        }
      />

      {mentors.isError ? (
        <ErrorState
          description="We couldn't load mentors."
          onRetry={() => void mentors.refetch()}
        />
      ) : mentors.isPending ? (
        <div
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
          aria-label="Loading mentors"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : mentors.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No mentors yet"
          description="Create a mentor to start assigning them to startups."
          action={
            <Button onClick={() => open(null)}>
              <Plus aria-hidden="true" /> Create Mentor
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search mentors"
              placeholder="Search by name or expertise"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(inputClasses, 'pl-9')}
            />
          </div>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-10 text-center text-[13px] text-muted">
              No mentors match that search.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((mentor) => (
                <MentorCard
                  key={mentor.id}
                  mentor={mentor}
                  onEdit={() => open(mentor)}
                  onDelete={() => setDeleting(mentor)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <MentorDialog open={dialogOpen} onOpenChange={setDialogOpen} mentor={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'mentor'}?`}
        description={
          deleting?.activeStartups.length
            ? 'This mentor is assigned to a startup. Remove the assignment first.'
            : 'If this mentor has worked with startups before, they are archived instead so notes and history are kept.'
        }
        confirmLabel="Delete mentor"
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}

function MentorCard({
  mentor,
  onEdit,
  onDelete,
}: {
  mentor: MentorWithAssignments;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const telegram = telegramUrl(mentor.telegram);
  const assigned = mentor.activeStartups;
  return (
    <li
      className={cn(
        'flex flex-col rounded-xl border border-line bg-white p-5 shadow-card',
        !mentor.is_active && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          name={mentor.name}
          src={publicFileUrl('mentor-photos', mentor.photo_path)}
          shape="circle"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[14.5px] font-semibold text-ink">{mentor.name}</h2>
            {!mentor.is_active && <Badge tone="neutral">Archived</Badge>}
          </div>
          <p className="truncate text-[12.5px] text-muted">{mentor.title || 'Mentor'}</p>
        </div>
      </div>
      {mentor.expertise.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Expertise">
          {mentor.expertise.map((item) => (
            <li
              key={item}
              className="rounded-full bg-primary-soft px-2 py-0.5 text-[11.5px] font-medium text-primary"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 text-[12.5px]">
        <p className="font-medium text-ink">
          {assigned.length} active startup{assigned.length === 1 ? '' : 's'}
        </p>
        {assigned.length > 0 && (
          <p className="mt-0.5 text-muted">
            {assigned.map((startup, index) => (
              <span key={startup.id}>
                {index > 0 && ', '}
                <Link
                  to={`${paths.admin.startupDetail(startup.id)}?tab=mentor`}
                  className="text-primary hover:underline"
                >
                  {startup.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-line pt-3">
        {mentor.email && (
          <a
            href={`mailto:${mentor.email}`}
            className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink"
            aria-label={`Email ${mentor.name}`}
          >
            <Mail className="h-4 w-4" />
          </a>
        )}
        {telegram && (
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 text-muted hover:bg-canvas hover:text-ink"
            aria-label={`${mentor.name} on Telegram`}
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${mentor.name}`}>
            <Pencil aria-hidden="true" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={`Delete ${mentor.name}`}
            disabled={assigned.length > 0}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </li>
  );
}
