import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { requiredText } from '@/domain/form-fields';
import { requestPasswordReset } from '@/features/auth/api';
import { getAuthErrorMessage } from '@/features/auth/errors';
import { authKeys } from '@/features/auth/query-keys';
import { useAuth } from '@/features/auth/useAuth';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/app';

const adminProfileSchema = z.object({ full_name: requiredText('Enter your full name.', 120) });

export function AdminSettingsPage() {
  const { profile } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Admin Settings"
        subtitle="Your administrator account."
      />
      {profile && <AdminProfileCard key={profile.updated_at} profile={profile} />}
      {profile && <PasswordCard email={profile.email} />}
      <Card>
        <div className="flex gap-3 text-[13px] text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <span className="font-medium text-ink">Access policy.</span> Admin accounts are created
            internally by authorized innoWIUT staff. There is no public admin sign up, and founder
            accounts cannot open administration pages.
          </p>
        </div>
      </Card>
    </div>
  );
}

function AdminProfileCard({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: { full_name: profile.full_name },
  });

  const save = useMutation({
    mutationFn: async (values: { full_name: string }) => {
      const { error } = await supabase.from('profiles').update(values).eq('id', profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.profile(profile.id) });
      toast.success('Profile saved.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save your profile.")),
  });

  return (
    <Card>
      <CardHeader title="Administrator" />
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
        <TextField label="Admin email" value={profile.email} readOnly disabled />
        <TextField
          label="Access level"
          value={profile.role === 'superadmin' ? 'Superadmin — manages admin access' : 'Admin'}
          readOnly
          disabled
        />
        <div className="flex items-end justify-end">
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!isDirty}
            className="w-full sm:w-auto"
          >
            Save
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
        description="We will email your administrator address a secure link to set a new password."
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
