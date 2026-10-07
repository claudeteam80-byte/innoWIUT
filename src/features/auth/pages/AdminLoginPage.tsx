import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useSignedInRedirect } from '@/routes/guards/useSignedInRedirect';
import { fetchProfile, signInWithPassword, signOutLocal } from '../api';
import { AuthHeading, CardAuthLayout } from '../components/AuthLayout';
import { ADMIN_ACCESS_DENIED_MESSAGE, getAuthErrorMessage } from '../errors';
import { authKeys } from '../query-keys';
import { sanitizeReturnTo } from '../return-to';
import { signInSchema } from '../schemas';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const redirectTo = useSignedInRedirect(!pending);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setPending(true);
    try {
      const { user } = await signInWithPassword(email, password);
      const profile = await fetchProfile(user.id);
      if (profile?.role !== 'admin') {
        await signOutLocal();
        setFormError(ADMIN_ACCESS_DENIED_MESSAGE);
        return;
      }
      queryClient.setQueryData(authKeys.profile(user.id), profile);
      const returnTo = sanitizeReturnTo(searchParams.get('returnTo'), paths.admin.root);
      navigate(returnTo ?? paths.admin.dashboard, { replace: true });
    } catch (error) {
      setFormError(getAuthErrorMessage(error, 'Sign in failed. Please try again.'));
    } finally {
      setPending(false);
    }
  });

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <CardAuthLayout eyebrow="Administration">
      <Link
        to={paths.authChoice}
        className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Access options
      </Link>
      <AuthHeading
        eyebrow="Administration"
        title="innoWIUT Admin Access"
        subtitle="Manage startup activity and monitor ecosystem progress."
      />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Admin Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAction={
            <Link
              to={`${paths.forgotPassword}?portal=admin`}
              className="text-[12.5px] font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          }
          {...register('password')}
        />
        <Button type="submit" fullWidth loading={pending}>
          Sign In to Admin Dashboard
        </Button>
      </form>

      <div className="mt-6 flex gap-3 rounded-lg bg-canvas p-3.5 text-[12.5px] text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          <span className="font-medium text-ink">Authorized personnel only.</span> Admin accounts
          are created internally by authorized innoWIUT staff. There is no public admin sign up.
        </p>
      </div>
    </CardAuthLayout>
  );
}
