import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { updatePassword, verifyRecoveryToken } from '../api';
import { AuthHeading, CardAuthLayout } from '../components/AuthLayout';
import { getAuthErrorMessage } from '../errors';
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from '../schemas';
import { useAuth } from '../useAuth';

type Verification = 'none' | 'pending' | 'verified' | 'failed';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { status } = useAuth();
  const tokenHash = searchParams.get('token_hash');
  const isRecoveryLink = Boolean(tokenHash) && searchParams.get('type') === 'recovery';

  const [verification, setVerification] = useState<Verification>(() =>
    isRecoveryLink ? 'pending' : 'none',
  );
  const started = useRef(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (verification !== 'pending' || !tokenHash || started.current) return;
    started.current = true;
    verifyRecoveryToken(tokenHash)
      .then(() => {
        setVerification('verified');
        // Remove the single-use token from the address bar and history.
        setSearchParams({}, { replace: true });
      })
      .catch(() => setVerification('failed'));
  }, [verification, tokenHash, setSearchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (error) {
      setFormError(
        getAuthErrorMessage(error, "We couldn't update your password. Please try again."),
      );
    }
  });

  let stage: 'checking' | 'ready' | 'invalid' | 'done';
  if (done) stage = 'done';
  else if (verification === 'pending') stage = 'checking';
  else if (verification === 'failed') stage = 'invalid';
  else if (verification === 'verified' || status === 'signed_in') stage = 'ready';
  else if (status === 'loading') stage = 'checking';
  else stage = 'invalid';

  return (
    <CardAuthLayout>
      <AuthHeading title="Choose a new password" />

      {stage === 'checking' && (
        <div className="flex justify-center py-6">
          <Spinner label="Checking your reset link" />
        </div>
      )}

      {stage === 'invalid' && (
        <div className="space-y-4">
          <Alert tone="error">This reset link is invalid or has expired. Request a new one.</Alert>
          <Link
            to={paths.forgotPassword}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      )}

      {stage === 'ready' && (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={errors.password?.message}
            {...register('password')}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" fullWidth loading={isSubmitting}>
            Update password
          </Button>
        </form>
      )}

      {stage === 'done' && (
        <div className="space-y-4">
          <Alert tone="success">Your password has been updated.</Alert>
          <Button fullWidth onClick={() => navigate(paths.root, { replace: true })}>
            Continue
          </Button>
        </div>
      )}
    </CardAuthLayout>
  );
}
