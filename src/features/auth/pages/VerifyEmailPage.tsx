import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { paths } from '@/app/paths';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useSignedInRedirect } from '@/routes/guards/useSignedInRedirect';
import { resendSignupCode, verifySignupCode } from '../api';
import { AuthHeading, FounderAuthLayout } from '../components/AuthLayout';
import { getAuthErrorMessage } from '../errors';
import { emailSchema, verificationCodeSchema } from '../schemas';

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parsedEmail = emailSchema.safeParse(searchParams.get('email') ?? '');
  const email = parsedEmail.success ? parsedEmail.data : null;
  const shouldResendOnOpen = searchParams.get('resend') === '1';

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const resentOnOpen = useRef(false);
  const redirectTo = useSignedInRedirect(!pending);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(verificationCodeSchema),
    defaultValues: { code: '' },
  });

  const secondsLeft = cooldownEndsAt ? Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (!cooldownEndsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownEndsAt]);

  async function resend(target: string) {
    setFormError(null);
    setNotice(null);
    try {
      await resendSignupCode(target);
      setNotice(`We sent a new code to ${target}.`);
      setNow(Date.now());
      setCooldownEndsAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (error) {
      setFormError(getAuthErrorMessage(error, "We couldn't send a new code. Please try again."));
    }
  }

  useEffect(() => {
    if (email && shouldResendOnOpen && !resentOnOpen.current) {
      resentOnOpen.current = true;
      void resend(email);
    }
  }, [email, shouldResendOnOpen]);

  const onSubmit = handleSubmit(async ({ code }) => {
    if (!email) return;
    setFormError(null);
    setPending(true);
    try {
      await verifySignupCode(email, code);
      navigate(paths.founder.onboarding, { replace: true });
    } catch (error) {
      setFormError(getAuthErrorMessage(error, 'Invalid verification code. Please try again.'));
    } finally {
      setPending(false);
    }
  });

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  if (!email) {
    return (
      <FounderAuthLayout>
        <AuthHeading
          title="Verify your email"
          subtitle="We couldn't tell which email address to verify."
        />
        <Link
          to={paths.founderSignup}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          Back to sign up
        </Link>
      </FounderAuthLayout>
    );
  }

  return (
    <FounderAuthLayout>
      <AuthHeading
        eyebrow="Founder Platform"
        title="Verify your email"
        subtitle={`Enter the 6-digit code we sent to ${email}.`}
      />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <TextField
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="123456"
          className="[&_input]:text-center [&_input]:font-mono [&_input]:text-[18px] [&_input]:tracking-[0.4em]"
          error={errors.code?.message}
          {...register('code')}
        />
        <Button type="submit" fullWidth loading={pending}>
          Verify
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-[13px] text-muted">
        <p>
          Didn&apos;t receive the code?{' '}
          <button
            type="button"
            onClick={() => void resend(email)}
            disabled={secondsLeft > 0}
            className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-subtle disabled:no-underline"
          >
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend'}
          </button>
        </p>
        <p>
          Already verified?{' '}
          <Link to={paths.founderLogin} className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </FounderAuthLayout>
  );
}
