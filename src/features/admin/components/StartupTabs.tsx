import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Link2, Mail, Phone, TrendingUp, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { externalUrl } from '@/domain/contact';
import { formatDate, formatRelativeDay } from '@/domain/dates';
import { localToday } from '@/domain/form-fields';
import { founderKeys } from '@/features/founder-keys';
import { useTeam } from '@/features/startup/hooks';
import { MetricCard } from '@/features/traction/components/MetricCard';
import { ChartSkeleton, MetricCardsSkeleton } from '@/features/traction/components/Skeletons';
import { TractionChart } from '@/features/traction/components/TractionChart';
import { TractionHistory } from '@/features/traction/components/TractionHistory';
import { useEntries, useMetrics } from '@/features/traction/hooks';
import { UpdateCard } from '@/features/updates/components/UpdateCard';
import { errorMessage } from '@/lib/errors';
import { publicFileUrl } from '@/lib/storage';
import { addMentorNote, assignMentor, endAssignment, type AdminStartup } from '../api';
import { useAdminNotes, useAssignments, useMentors, usePublishedUpdates } from '../hooks';
import { adminKeys } from '../keys';
import { mentorNoteSchema, type MentorNoteInput } from '../schemas';
import { InfoGrid } from './InfoGrid';

const link = (href: string | null, text: string) =>
  href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {text}
    </a>
  ) : null;

export function OverviewTab({
  startup,
  lastActive,
}: {
  startup: AdminStartup;
  lastActive: string | null;
}) {
  const website = externalUrl(startup.website);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Startup information" />
        <InfoGrid
          items={[
            { label: 'Description', value: startup.description, wide: true },
            { label: 'Industry', value: startup.industry },
            { label: 'Stage', value: startup.stage },
            { label: 'Founded', value: startup.founded_year },
            { label: 'Team size', value: startup.team_size },
            {
              label: 'Website',
              value: link(website, (startup.website ?? '').replace(/^https?:\/\//, '')),
            },
            {
              label: 'Latest activity',
              value: lastActive ? formatRelativeDay(lastActive) : 'No activity',
            },
            {
              label: 'Working product',
              value: startup.has_product === null ? null : startup.has_product ? 'Yes' : 'No',
            },
            {
              label: 'Has users',
              value: startup.has_users === null ? null : startup.has_users ? 'Yes' : 'No',
            },
            {
              label: 'Has revenue',
              value: startup.has_revenue === null ? null : startup.has_revenue ? 'Yes' : 'No',
            },
            {
              label: 'Joined innoWIUT',
              value: formatDate(startup.onboarding_completed_at ?? startup.created_at),
            },
            { label: 'Current goal', value: startup.main_goal, wide: true },
            { label: 'Current challenge', value: startup.biggest_challenge, wide: true },
          ]}
        />
      </Card>
      <FounderCard startup={startup} />
    </div>
  );
}

export function FounderCard({ startup }: { startup: AdminStartup }) {
  const founder = startup.owner;
  return (
    <Card>
      <CardHeader title="Founder" />
      {founder ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={founder.full_name || founder.email} shape="circle" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">
                {founder.full_name || 'Founder'}
              </p>
              <p className="text-[12.5px] text-muted">{startup.founder_role ?? 'Founder'}</p>
            </div>
          </div>
          <ul className="space-y-2 text-[13px]">
            <li className="flex items-center gap-2 text-ink">
              <Mail className="h-4 w-4 text-subtle" aria-hidden="true" />
              <a href={`mailto:${founder.email}`} className="truncate text-primary hover:underline">
                {founder.email}
              </a>
            </li>
            {founder.phone && (
              <li className="flex items-center gap-2 text-ink">
                <Phone className="h-4 w-4 text-subtle" aria-hidden="true" />
                <a href={`tel:${founder.phone.replace(/\s/g, '')}`} className="hover:underline">
                  {founder.phone}
                </a>
              </li>
            )}
            {founder.linkedin_url && (
              <li className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-subtle" aria-hidden="true" />
                {link(externalUrl(founder.linkedin_url), 'LinkedIn')}
              </li>
            )}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-muted">Founder profile unavailable.</p>
      )}
    </Card>
  );
}

/** Read-only for admins: no add / update actions. */
export function TractionTab({ startupId }: { startupId: string }) {
  const metrics = useMetrics(startupId);
  const entries = useEntries(startupId);
  if (metrics.isError || entries.isError) {
    return <ErrorState onRetry={() => void Promise.all([metrics.refetch(), entries.refetch()])} />;
  }
  if (metrics.isPending || entries.isPending) {
    return (
      <div className="space-y-4">
        <MetricCardsSkeleton />
        <ChartSkeleton />
      </div>
    );
  }
  if (metrics.data.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No traction yet"
        description="This founder has not added traction metrics."
      />
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.data.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>
      <Card>
        <CardHeader title="Trend" />
        <TractionChart metrics={metrics.data} entries={entries.data} />
      </Card>
      <Card>
        <CardHeader
          title="Traction history"
          description="Every value the founder recorded, newest first."
        />
        <TractionHistory entries={entries.data} metrics={metrics.data} />
      </Card>
    </div>
  );
}

export function UpdatesTab({ startupId }: { startupId: string }) {
  const updates = usePublishedUpdates(startupId);
  if (updates.isError) return <ErrorState onRetry={() => void updates.refetch()} />;
  if (updates.isPending) return <Skeleton className="h-40 w-full rounded-xl" />;
  const published = updates.data.filter((u) => u.status === 'published');
  if (published.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No published updates"
        description="This founder has not published a progress update yet."
      />
    );
  }
  return (
    <div className="space-y-4">
      {published.map((update) => (
        <UpdateCard key={update.id} update={update} />
      ))}
    </div>
  );
}

export function TeamTab({ startup }: { startup: AdminStartup }) {
  const team = useTeam(startup.id);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <FounderCard startup={startup} />
      <Card className="lg:col-span-2">
        <CardHeader title="Team members" description="Listed by the founder. Read-only." />
        {team.isError ? (
          <ErrorState onRetry={() => void team.refetch()} />
        ) : team.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : team.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members listed"
            description="The founder has not added teammates yet."
          />
        ) : (
          <ul className="divide-y divide-line">
            {team.data.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar name={member.name} size="sm" shape="circle" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{member.name}</p>
                  <p className="text-[12.5px] text-muted">{member.role || 'Team member'}</p>
                </div>
                <div className="flex gap-3 text-[12.5px]">
                  {member.email && (
                    <a href={`mailto:${member.email}`} className="text-primary hover:underline">
                      {member.email}
                    </a>
                  )}
                  {member.linkedin_url && link(externalUrl(member.linkedin_url), 'LinkedIn')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function MentorTab({ startupId, startupName }: { startupId: string; startupName: string }) {
  const queryClient = useQueryClient();
  const assignments = useAssignments(startupId);
  const notes = useAdminNotes(startupId);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);

  const current = assignments.data?.find((a) => a.ended_at === null) ?? null;
  const history = assignments.data?.filter((a) => a.ended_at !== null) ?? [];

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.assignments(startupId) }),
      queryClient.invalidateQueries({ queryKey: adminKeys.mentors }),
      queryClient.invalidateQueries({ queryKey: adminKeys.stats }),
      queryClient.invalidateQueries({ queryKey: adminKeys.startupsAll }),
      queryClient.invalidateQueries({ queryKey: founderKeys.mentor(startupId) }),
    ]);

  const remove = useMutation({
    mutationFn: () => endAssignment(startupId),
    onSuccess: async () => {
      await refresh();
      setRemoving(false);
      toast.success('Mentor assignment removed.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't remove the assignment.")),
  });

  if (assignments.isError) return <ErrorState onRetry={() => void assignments.refetch()} />;
  if (assignments.isPending) return <Skeleton className="h-40 w-full rounded-xl" />;

  const mentor = current?.mentor ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader
            title="Current mentor"
            action={
              <div className="flex gap-2">
                {mentor && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(true)}>
                    Remove assignment
                  </Button>
                )}
                <Button size="sm" onClick={() => setAssigning(true)}>
                  {mentor ? 'Change mentor' : 'Assign mentor'}
                </Button>
              </div>
            }
          />
          {mentor ? (
            <div className="flex items-center gap-4">
              <Avatar
                name={mentor.name}
                src={publicFileUrl('mentor-photos', mentor.photo_path)}
                size="lg"
                shape="circle"
              />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-ink">{mentor.name}</p>
                <p className="text-[13px] text-muted">
                  {mentor.expertise.join(' · ') || mentor.title || 'Mentor'}
                </p>
                <p className="mt-1 text-[12px] text-subtle">
                  Assigned {formatDate(current?.assigned_at)}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={UserRound}
              title="No mentor assigned"
              description={`Assign an innoWIUT mentor so ${startupName} has someone to work with.`}
            />
          )}
        </Card>
        <NotesCard
          startupId={startupId}
          mentorId={mentor?.id ?? null}
          mentorName={mentor?.name ?? null}
          notes={notes}
        />
      </div>
      <Card>
        <CardHeader title="Assignment history" />
        {history.length === 0 ? (
          <p className="text-[13px] text-muted">No previous mentors.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((item) => (
              <li key={item.id} className="text-[13px]">
                <p className="font-medium text-ink">{item.mentor?.name ?? 'Removed mentor'}</p>
                <p className="text-[12px] text-muted">
                  {formatDate(item.assigned_at)} – {formatDate(item.ended_at)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <AssignMentorDialog
        open={assigning}
        onOpenChange={setAssigning}
        startupId={startupId}
        currentMentorId={mentor?.id ?? null}
        onAssigned={refresh}
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove mentor assignment?"
        description={`${mentor?.name ?? 'The mentor'} will no longer appear on the founder's Mentor page. The assignment stays in the history and existing notes are kept.`}
        confirmLabel="Remove assignment"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

function AssignMentorDialog({
  open,
  onOpenChange,
  startupId,
  currentMentorId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  currentMentorId: string | null;
  onAssigned: () => Promise<unknown>;
}) {
  const mentors = useMentors();
  const [selected, setSelected] = useState('');
  const choice = selected || currentMentorId || '';
  const activeMentors = (mentors.data ?? []).filter((m) => m.is_active);

  const assign = useMutation({
    mutationFn: () => assignMentor(startupId, choice),
    onSuccess: async () => {
      await onAssigned();
      toast.success('Mentor assigned. The founder can see them now.');
      setSelected('');
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't assign this mentor.")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={currentMentorId ? 'Change mentor' : 'Assign mentor'}
      description="The founder sees the assigned mentor and their notes on their Mentor page. Previous assignments stay in the history."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => assign.mutate()}
            loading={assign.isPending}
            disabled={!choice || choice === currentMentorId}
          >
            Assign mentor
          </Button>
        </>
      }
    >
      {mentors.isError ? (
        <ErrorState onRetry={() => void mentors.refetch()} />
      ) : mentors.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : activeMentors.length === 0 ? (
        <p className="text-[13px] text-muted">
          There are no active mentors yet. Create one on the Mentors page first.
        </p>
      ) : (
        <SelectField
          label="Mentor"
          value={choice}
          onChange={(event) => setSelected(event.target.value)}
          placeholder="Select a mentor"
          options={activeMentors.map((m) => ({
            value: m.id,
            label: `${m.name}${m.activeStartups.length ? ` (${m.activeStartups.length} startup${m.activeStartups.length === 1 ? '' : 's'})` : ''}`,
          }))}
        />
      )}
    </Dialog>
  );
}

function NotesCard({
  startupId,
  mentorId,
  mentorName,
  notes,
}: {
  startupId: string;
  mentorId: string | null;
  mentorName: string | null;
  notes: ReturnType<typeof useAdminNotes>;
}) {
  const queryClient = useQueryClient();
  const defaults: MentorNoteInput = { body: '', note_date: localToday() };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(mentorNoteSchema), defaultValues: defaults });

  const add = useMutation({
    mutationFn: (values: { body: string; note_date: string }) =>
      addMentorNote({ startupId, mentorId, body: values.body, noteDate: values.note_date }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.notes(startupId) }),
        queryClient.invalidateQueries({ queryKey: founderKeys.notes(startupId) }),
      ]);
      reset(defaults);
      toast.success('Note added. The founder can see it on their Mentor page.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't add this note.")),
  });

  return (
    <Card>
      <CardHeader
        title="Mentor notes"
        description="Guidance the founder sees on their Mentor page."
      />
      {mentorId ? (
        <form
          onSubmit={handleSubmit((values) => add.mutate(values))}
          noValidate
          className="mb-6 space-y-3 rounded-lg bg-canvas p-4"
        >
          <TextareaField
            label={`New note from ${mentorName}`}
            rows={3}
            placeholder="e.g. Focus on retention before increasing acquisition."
            error={errors.body?.message}
            {...register('body')}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <TextField
              label="Date"
              type="date"
              max={localToday()}
              className="sm:w-48"
              error={errors.note_date?.message}
              {...register('note_date')}
            />
            <Button type="submit" loading={add.isPending}>
              Add note
            </Button>
          </div>
        </form>
      ) : (
        <p className="mb-4 rounded-lg bg-canvas px-4 py-3 text-[13px] text-muted">
          Assign a mentor to add notes on their behalf.
        </p>
      )}
      {notes.isError ? (
        <ErrorState onRetry={() => void notes.refetch()} />
      ) : notes.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : notes.data.length === 0 ? (
        <p className="text-[13px] text-muted">No notes yet.</p>
      ) : (
        <ol className="space-y-3">
          {notes.data.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border-l-2 border-primary bg-canvas-subtle px-4 py-3"
            >
              <p className="whitespace-pre-line text-[13.5px] leading-6 text-ink">{note.body}</p>
              <p className="mt-2 flex flex-wrap gap-x-2 text-[12px] text-muted">
                <span>{formatDate(note.note_date, 'long')}</span>
                <span>· Mentor: {note.mentor?.name ?? '—'}</span>
                <span>
                  · Added by {note.author?.full_name || note.author?.email || 'innoWIUT admin'}
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
