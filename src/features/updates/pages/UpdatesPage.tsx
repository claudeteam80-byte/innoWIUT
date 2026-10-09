import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { founderKeys } from '@/features/founder-keys';
import { useMyStartup } from '@/features/startup/hooks';
import { errorMessage } from '@/lib/errors';
import { removeFile } from '@/lib/storage';
import { deleteDraft, publishDraft, type StartupUpdate } from '../api';
import { UpdateCard } from '../components/UpdateCard';
import { UpdateDialog } from '../components/UpdateDialog';
import { useUpdateContext, useUpdates } from '../hooks';
import { canQuickPublish } from '../schemas';

type Filter = 'all' | 'draft' | 'published';

export function UpdatesPage() {
  const queryClient = useQueryClient();
  const startup = useMyStartup();
  const startupId = startup.data?.id;
  const updates = useUpdates(startupId);
  const context = useUpdateContext(startupId);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<StartupUpdate | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StartupUpdate | null>(null);

  const list = useMemo(() => updates.data ?? [], [updates.data]);
  const counts = {
    all: list.length,
    draft: list.filter((u) => u.status === 'draft').length,
    published: list.filter((u) => u.status === 'published').length,
  };
  const visible = filter === 'all' ? list : list.filter((u) => u.status === filter);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: founderKeys.updates(startupId ?? '') });

  const publish = useMutation({
    mutationFn: (update: StartupUpdate) => publishDraft(update.id),
    onSuccess: async () => {
      await refresh();
      toast.success('Update published. innoWIUT can see your progress now.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't publish this update.")),
  });

  const remove = useMutation({
    mutationFn: async (update: StartupUpdate) => {
      // Evidence rows go with the draft (database cascade); their files are removed here.
      const files = (context?.evidence ?? [])
        .filter((item) => item.update_id === update.id && item.file_path)
        .map((item) => item.file_path);
      const deleted = await deleteDraft(update.id);
      if (!deleted) throw new Error('Only drafts can be deleted.');
      await Promise.all(
        [update.image_path, ...files].map((path) => removeFile('update-attachments', path)),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: founderKeys.evidence(startupId ?? '') }),
      ]);
      setDeleting(null);
      toast.success('Draft deleted.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't delete this draft.")),
  });

  function onPublish(update: StartupUpdate) {
    if (!canQuickPublish(update)) {
      toast.info('Add what moved and a progress type before publishing.');
      setEditing(update);
      return;
    }
    publish.mutate(update);
  }

  const create = () => setCreating(true);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Updates"
        title="Startup Updates"
        subtitle="Prove progress — what changed, what backs it up and what is next."
        actions={
          <Button onClick={create} disabled={!startupId}>
            <Plus aria-hidden="true" /> Create Update
          </Button>
        }
      />

      {startup.isError || updates.isError ? (
        <ErrorState
          onRetry={() => void (startup.isError ? startup.refetch() : updates.refetch())}
        />
      ) : startup.isPending || updates.isPending ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading updates">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-line bg-white p-6">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No updates yet"
          description="Share your first progress update with innoWIUT."
          action={
            <Button onClick={create}>
              <Plus aria-hidden="true" /> Create Update
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Tabs
              label="Filter updates"
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'draft', label: 'Drafts', count: counts.draft },
                { value: 'published', label: 'Published', count: counts.published },
              ]}
            />
          </div>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-10 text-center text-[13px] text-muted">
              {filter === 'draft'
                ? 'No drafts. Everything you have written is published.'
                : 'Nothing published yet.'}
            </p>
          ) : (
            <div className="space-y-4">
              {visible.map((update) => (
                <UpdateCard
                  key={update.id}
                  update={update}
                  context={context}
                  onEdit={() => setEditing(update)}
                  onPublish={() => onPublish(update)}
                  onDelete={() => setDeleting(update)}
                  publishing={publish.isPending && publish.variables?.id === update.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {startupId && (
        <UpdateDialog
          open={creating || editing !== null}
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              setEditing(null);
            }
          }}
          startupId={startupId}
          update={editing}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this draft?"
        description="The draft, its image and its evidence will be permanently removed. Published updates cannot be deleted."
        confirmLabel="Delete draft"
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </div>
  );
}
