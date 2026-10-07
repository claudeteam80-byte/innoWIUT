import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { CheckboxField } from '@/components/ui/CheckboxField';
import { TextField } from '@/components/ui/TextField';
import { useSignedInRedirect } from '@/routes/guards/useSignedInRedirect';
import { signUpFounder } from '../api';
import { AuthHeading, FounderAuthLayout } from '../components/AuthLayout';
import { getAuthErrorMessage } from '../errors';
import { founderSignUpSchema, PASSWORD_MIN_LENGTH } from '../schemas';

export function FounderSignupPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const redirectTo = useSignedInRedirect(!pending);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(founderSignUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const onSubmit = handleSubmit(async ({ fullName, email, password }) => {
    setFormError(null);
    setPending(true);
    try {
      const { session } = await signUpFounder({ fullName, email, password });
      if (session) {
        // Email confirmation is disabled in this environment.
        navigate(paths.founder.onboarding, { replace: true });
        return;
      }
      navigate(`${paths.founderVerifyEmail}?email=${encodeURIComponent(email)}`, { replace: true });
    } catch (error) {
      setFormError(getAuthErrorMessage(error, 'Registration failed. Please try again.'));
    } finally {
      setPending(false);
    }
  });

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <FounderAuthLayout>
      <AuthHeading
        eyebrow="Founder Platform"
        title="Create your Founder Account"
        subtitle="Start tracking your startup with innoWIUT."
      />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField
          label="Full Name"
          autoComplete="name"
          placeholder="Yodgor Karimov"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
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
          autoComplete="new-password"
          placeholder="••••••••"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <CheckboxField
          label="I agree to the Terms and Privacy Policy"
          error={errors.acceptTerms?.message}
          {...register('acceptTerms')}
        />
        <Button type="submit" fullWidth loading={pending}>
          Create Founder Account
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-[13px] text-muted">
        <p>
          Already have an account?{' '}
          <Link to={paths.founderLogin} className="font-medium text-primary hover:underline">
            Sign In
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
