import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { isAdminRole } from '@/routes/guards/access';
import { useSignedInRedirect } from '@/routes/guards/useSignedInRedirect';
import { fetchProfile, signInWithPassword, signOutLocal } from '../api';
import { AuthHeading, FounderAuthLayout } from '../components/AuthLayout';
import { getAuthErrorCode, getAuthErrorMessage } from '../errors';
import { authKeys } from '../query-keys';
import { sanitizeReturnTo } from '../return-to';
import { signInSchema } from '../schemas';

export function FounderLoginPage() {
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
      if (profile?.role !== 'founder') {
        await signOutLocal();
        setFormError(
          isAdminRole(profile?.role)
            ? 'This is an innoWIUT admin account. Use Admin access to sign in.'
            : "We couldn't load your founder account. Please try again.",
        );
        return;
      }
      queryClient.setQueryData(authKeys.profile(user.id), profile);
      const returnTo = sanitizeReturnTo(searchParams.get('returnTo'), paths.founder.root);
      navigate(returnTo ?? paths.founder.dashboard, { replace: true });
    } catch (error) {
      if (getAuthErrorCode(error) === 'email_not_confirmed') {
        navigate(`${paths.founderVerifyEmail}?email=${encodeURIComponent(email)}&resend=1`);
        return;
      }
      setFormError(getAuthErrorMessage(error, 'Sign in failed. Please try again.'));
    } finally {
      setPending(false);
    }
  });

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <FounderAuthLayout>
      <AuthHeading
        eyebrow="Founder Platform"
        title="Welcome back, Founder"
        subtitle="Sign in to your innoWIUT founder workspace."
      />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@wiut.uz"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          labelAction={
            <Link
              to={paths.forgotPassword}
              className="text-[12.5px] font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          }
          {...register('password')}
        />
        <Button type="submit" fullWidth loading={pending}>
          Sign In
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-[13px] text-muted">
        <p>
          New to innoWIUT?{' '}
          <Link to={paths.founderSignup} className="font-medium text-primary hover:underline">
            Create Founder Account
          </Link>
        </p>
        <p>
          innoWIUT staff?{' '}
          <Link to={paths.adminLogin} className="font-medium text-primary hover:underline">
            Admin access
          </Link>
        </p>
      </div>
    </FounderAuthLayout>
  );
}
