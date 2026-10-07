import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImagePicker } from '@/components/shared/ImagePicker';
import { useAuth } from '@/features/auth/useAuth';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { publicFileUrl, removeFile, storagePath, uploadWithProgress } from '@/lib/storage';
import { updateStartup, type Startup } from '../api';

/** Logo on the profile page: uploads as soon as a valid image is chosen. */
export function LogoUploader({ startup }: { startup: Startup }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);

  const done = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: founderKeys.startup(user?.id) });
    setProgress(null);
    toast.success(message);
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setProgress(0);
      const path = await uploadWithProgress(
        'startup-logos',
        storagePath(startup.id, 'logo', file),
        file,
        setProgress,
      );
      try {
        await updateStartup(startup.id, { logo_path: path });
      } catch (error) {
        await removeFile('startup-logos', path);
        throw error;
      }
      await removeFile('startup-logos', startup.logo_path);
    },
    onSuccess: () => done('Logo updated.'),
    onError: (error) => {
      setProgress(null);
      toast.error(errorMessage(error, "We couldn't upload your logo."));
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      await updateStartup(startup.id, { logo_path: null });
      await removeFile('startup-logos', startup.logo_path);
    },
    onSuccess: () => done('Logo removed.'),
    onError: (error) => toast.error(errorMessage(error, "We couldn't remove your logo.")),
  });

  return (
    <ImagePicker
      label="Logo"
      bucket="startup-logos"
      file={null}
      currentUrl={publicFileUrl('startup-logos', startup.logo_path)}
      onFileChange={(file) => file && upload.mutate(file)}
      onRemoveCurrent={() => clear.mutate()}
      progress={progress}
      disabled={upload.isPending || clear.isPending}
    />
  );
}
