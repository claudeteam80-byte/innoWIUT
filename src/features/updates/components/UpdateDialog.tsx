import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ImagePicker } from '@/components/shared/ImagePicker';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { removeFile, storagePath, uploadWithProgress } from '@/lib/storage';
import { createUpdate, editUpdate, type StartupUpdate } from '../api';
import { useSignedImageUrl } from '../hooks';
import {
  buildUpdateRow,
  updateSchemaFor,
  type UpdateAction,
  type UpdateFormValues,
} from '../schemas';

const defaultTitle = () =>
  `Weekly Update — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

function valuesFrom(update?: StartupUpdate | null): UpdateFormValues {
  return {
    title: update?.title ?? defaultTitle(),
    summary: update?.summary ?? '',
    highlights: (update?.highlights.length ? update.highlights : ['']).map((text) => ({ text })),
    challenge: update?.challenge ?? '',
    next_steps: update?.next_steps ?? '',
    link_url: update?.link_url ?? '',
  };
}

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  /** Draft being edited; omit to create a new update. */
  update?: StartupUpdate | null;
}

export function UpdateDialog(props: UpdateDialogProps) {
  // Remount per update so the form starts from that update's values.
  return props.open ? <UpdateForm key={props.update?.id ?? 'new'} {...props} /> : null;
}

function UpdateForm({ open, onOpenChange, startupId, update }: UpdateDialogProps) {
  const queryClient = useQueryClient();
  const action = useRef<UpdateAction>('draft');
  const [file, setFile] = useState<File | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const existingImage = useSignedImageUrl(removeExisting ? null : update?.image_path);

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
    formState: { errors },
  } = useForm<UpdateFormValues>({ resolver, defaultValues: valuesFrom(update) });
  const highlights = useFieldArray({ control, name: 'highlights' });

  const mutation = useMutation({
    mutationFn: async ({ values, mode }: { values: UpdateFormValues; mode: UpdateAction }) => {
      const row = buildUpdateRow(values, mode);
      const previousImage = update?.image_path ?? null;
      let uploaded: string | null = null;
      if (file) {
        setProgress(0);
        uploaded = await uploadWithProgress(
          'update-attachments',
          storagePath(startupId, 'update', file),
          file,
          setProgress,
        );
      }
      const imagePath = uploaded ?? (removeExisting ? null : previousImage);
      try {
        const saved = update
          ? await editUpdate(update.id, { ...row, image_path: imagePath })
          : await createUpdate(startupId, { ...row, image_path: imagePath });
        if (previousImage && previousImage !== imagePath)
          await removeFile('update-attachments', previousImage);
        return saved;
      } catch (error) {
        if (uploaded) await removeFile('update-attachments', uploaded);
        throw error;
      }
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.updates(startupId) });
      toast.success(
        saved.status === 'published'
          ? 'Update published. innoWIUT can see your progress now.'
          : 'Draft saved.',
      );
      onOpenChange(false);
    },
    onError: (error) => {
      setProgress(null);
      toast.error(errorMessage(error, "We couldn't save your update. Please try again."));
    },
  });

  const submit = (mode: UpdateAction) => {
    action.current = mode;
    void handleSubmit((values) => mutation.mutate({ values, mode }))();
  };

  const busy = mutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      size="lg"
      title={update ? 'Edit draft' : 'New update'}
      description="Share what changed since your last update."
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
      <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-4">
        <TextField
          label="Update title"
          required
          error={errors.title?.message}
          {...register('title')}
        />
        <TextareaField
          label="What happened?"
          required
          rows={4}
          placeholder="What did you ship, learn or change since your last update?"
          hint="Required to publish."
          error={errors.summary?.message}
          {...register('summary')}
        />
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium text-ink">Highlights</legend>
          {highlights.fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <TextField
                label={`Highlight ${index + 1}`}
                className="flex-1 [&_label]:sr-only"
                placeholder="e.g. Signed our first pilot customer"
                error={errors.highlights?.[index]?.text?.message}
                {...register(`highlights.${index}.text`)}
              />
              <Button
                variant="ghost"
                size="md"
                aria-label={`Remove highlight ${index + 1}`}
                onClick={() => highlights.remove(index)}
                disabled={highlights.fields.length === 1}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}
          {highlights.fields.length < 20 && (
            <Button variant="ghost" size="sm" onClick={() => highlights.append({ text: '' })}>
              <Plus aria-hidden="true" /> Add highlight
            </Button>
          )}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextareaField
            label="Challenges"
            hint="Optional"
            error={errors.challenge?.message}
            {...register('challenge')}
          />
          <TextareaField
            label="Next steps"
            hint="Optional"
            error={errors.next_steps?.message}
            {...register('next_steps')}
          />
        </div>
        <TextField
          label="External link"
          hint="Optional — e.g. a demo, article or product page."
          inputMode="url"
          placeholder="https://"
          error={errors.link_url?.message}
          {...register('link_url')}
        />
        <ImagePicker
          label="Image (optional)"
          bucket="update-attachments"
          variant="wide"
          file={file}
          onFileChange={(next) => {
            setFile(next);
            if (next) setRemoveExisting(false);
          }}
          currentUrl={existingImage.data ?? null}
          onRemoveCurrent={() => setRemoveExisting(true)}
          progress={progress}
          disabled={busy}
        />
      </form>
    </Dialog>
  );
}
