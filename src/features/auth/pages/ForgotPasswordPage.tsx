import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { requestPasswordReset } from '../api';
import { AuthHeading, CardAuthLayout } from '../components/AuthLayout';
import { getAuthErrorCode, getAuthErrorMessage, NETWORK_ERROR_MESSAGE } from '../errors';
import { forgotPasswordSchema } from '../schemas';

// Errors worth showing; anything else gets the generic confirmation so the page
// never reveals whether an account exists.
const SURFACED_ERRORS = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get('portal') === 'admin';
  const signInPath = isAdmin ? paths.adminLogin : paths.founderLogin;
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (error) {
      const message = getAuthErrorMessage(error, '');
      const code = getAuthErrorCode(error);
      if ((code && SURFACED_ERRORS.has(code)) || message === NETWORK_ERROR_MESSAGE) {
        setFormError(message);
      } else {
        setSentTo(email);
      }
    }
  });

  return (
    <CardAuthLayout eyebrow={isAdmin ? 'Administration' : 'Founder Platform'}>
      <AuthHeading title="Reset password" subtitle="We'll send you a link to reset it." />
      {sentTo ? (
        <Alert tone="success">
          If an account exists for <span className="font-medium">{sentTo}</span>, a reset link is on
          its way. Check your inbox and spam folder.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" fullWidth loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-[13px]">
        <Link to={signInPath} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </CardAuthLayout>
  );
}
