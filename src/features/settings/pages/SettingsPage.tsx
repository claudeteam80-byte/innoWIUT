import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { requestPasswordReset } from '@/features/auth/api';
import { getAuthErrorMessage } from '@/features/auth/errors';
import { authKeys } from '@/features/auth/query-keys';
import { useAuth } from '@/features/auth/useAuth';
import { errorMessage } from '@/lib/errors';
import type { Profile } from '@/types/app';
import { updateOwnProfile } from '../api';
import { profileSettingsSchema } from '../schemas';

export function SettingsPage() {
  const { profile } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        subtitle="Your founder profile and password."
      />
      {profile && <ProfileForm key={profile.updated_at} profile={profile} />}
      {profile && <PasswordCard email={profile.email} />}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      full_name: profile.full_name,
      phone: profile.phone ?? '',
      linkedin_url: profile.linkedin_url ?? '',
    },
  });

  const save = useMutation({
    mutationFn: (values: { full_name: string; phone: string; linkedin_url: string | null }) =>
      updateOwnProfile(profile.id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.profile(profile.id) });
      toast.success('Profile saved.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save your profile.")),
  });

  return (
    <Card>
      <CardHeader title="Profile" />
      <form
        onSubmit={handleSubmit((values) => save.mutate(values))}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <TextField
          label="Full name"
          required
          autoComplete="name"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <TextField
          label="Email"
          value={profile.email}
          readOnly
          disabled
          hint="Contact innoWIUT to change your sign-in email."
        />
        <TextField
          label="Phone number"
          required
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="LinkedIn URL"
          hint="Optional"
          inputMode="url"
          error={errors.linkedin_url?.message}
          {...register('linkedin_url')}
        />
        <div className="flex justify-end sm:col-span-2">
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!isDirty}
            className="w-full sm:w-auto"
          >
            Save Profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard({ email }: { email: string }) {
  const reset = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onSuccess: () => toast.success(`Reset link sent. Check ${email}.`),
    onError: (error) =>
      toast.error(getAuthErrorMessage(error, "We couldn't send the reset link. Please try again.")),
  });
  return (
    <Card>
      <CardHeader
        title="Password"
        description="We will email you a secure link to set a new password."
      />
      <Button
        variant="outline"
        loading={reset.isPending}
        onClick={() => reset.mutate()}
        className="w-full sm:w-auto"
      >
        Send password reset link
      </Button>
    </Card>
  );
}
