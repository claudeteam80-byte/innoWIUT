import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ImagePicker } from '@/components/shared/ImagePicker';
import { Button } from '@/components/ui/Button';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { Dialog } from '@/components/ui/Dialog';
import { TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { errorMessage } from '@/lib/errors';
import { publicFileUrl, removeFile, storagePath, uploadWithProgress } from '@/lib/storage';
import { createMentor, updateMentor, type MentorWithAssignments } from '../api';
import { mentorSchema, type MentorFormInput, type MentorFormOutput } from '../schemas';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentor: MentorWithAssignments | null;
}

export function MentorDialog(props: Props) {
  return props.open ? <MentorForm key={props.mentor?.id ?? 'new'} {...props} /> : null;
}

function MentorForm({ open, onOpenChange, mentor }: Props) {
  const queryClient = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const defaults: MentorFormInput = {
    name: mentor?.name ?? '',
    title: mentor?.title ?? '',
    email: mentor?.email ?? '',
    telegram: mentor?.telegram ?? '',
    linkedin_url: mentor?.linkedin_url ?? '',
    expertise: mentor?.expertise.join(', ') ?? '',
    bio: mentor?.bio ?? '',
    is_active: mentor?.is_active ?? true,
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(mentorSchema), defaultValues: defaults });

  const save = useMutation({
    mutationFn: async (values: MentorFormOutput) => {
      const saved = mentor
        ? { id: mentor.id, photo_path: mentor.photo_path }
        : await createMentor(values);
      if (mentor) await updateMentor(mentor.id, values);
      const previous = saved.photo_path;
      if (photo) {
        setProgress(0);
        const path = await uploadWithProgress(
          'mentor-photos',
          storagePath(saved.id, 'photo', photo),
          photo,
          setProgress,
        );
        await updateMentor(saved.id, { photo_path: path });
        await removeFile('mentor-photos', previous);
      } else if (removePhoto && previous) {
        await updateMentor(saved.id, { photo_path: null });
        await removeFile('mentor-photos', previous);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(mentor ? 'Mentor updated.' : 'Mentor created.');
      onOpenChange(false);
    },
    onError: (error) => {
      setProgress(null);
      toast.error(errorMessage(error, "We couldn't save this mentor."));
    },
  });

  const busy = save.isPending;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      size="lg"
      title={mentor ? 'Edit mentor' : 'Create mentor'}
      description="Mentors are profiles, not logins. Founders see their assigned mentor's details."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="mentor-form" loading={busy}>
            {mentor ? 'Save Changes' : 'Create Mentor'}
          </Button>
        </>
      }
    >
      <form
        id="mentor-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <ImagePicker
            label="Photo (optional)"
            bucket="mentor-photos"
            file={photo}
            onFileChange={(file) => {
              setPhoto(file);
              if (file) setRemovePhoto(false);
            }}
            currentUrl={removePhoto ? null : publicFileUrl('mentor-photos', mentor?.photo_path)}
            onRemoveCurrent={() => setRemovePhoto(true)}
            progress={progress}
            disabled={busy}
          />
        </div>
        <TextField label="Full name" required error={errors.name?.message} {...register('name')} />
        <TextField
          label="Title"
          hint="Optional, e.g. Startup Mentor"
          error={errors.title?.message}
          {...register('title')}
        />
        <TextField
          label="Expertise"
          required
          className="sm:col-span-2"
          hint="Separate with commas, e.g. Growth, Fundraising, Product"
          error={errors.expertise?.message}
          {...register('expertise')}
        />
        <TextField
          label="Email"
          hint="Optional"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Telegram"
          hint="Optional — @username or t.me link"
          error={errors.telegram?.message}
          {...register('telegram')}
        />
        <TextField
          label="LinkedIn"
          hint="Optional"
          inputMode="url"
          className="sm:col-span-2"
          error={errors.linkedin_url?.message}
          {...register('linkedin_url')}
        />
        <TextareaField
          label="Bio"
          hint="Optional"
          rows={4}
          className="sm:col-span-2"
          error={errors.bio?.message}
          {...register('bio')}
        />
        {mentor && (
          <div className="sm:col-span-2">
            <CheckboxField
              label="Active — available for new assignments"
              {...register('is_active')}
            />
          </div>
        )}
      </form>
    </Dialog>
  );
}
