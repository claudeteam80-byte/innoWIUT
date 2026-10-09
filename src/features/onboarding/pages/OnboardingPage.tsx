import { useRef, useState } from 'react';
import { useDocumentTitle } from '@/lib/document-title';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { paths } from '@/app/paths';
import { BrandMark } from '@/components/shared/BrandMark';
import { ImagePicker } from '@/components/shared/ImagePicker';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { CURRENCIES, FOUNDER_ROLES, INDUSTRIES, STAGE_OPTIONS } from '@/domain/options';
import { authKeys } from '@/features/auth/query-keys';
import { useAuth } from '@/features/auth/useAuth';
import { founderKeys } from '@/features/founder-keys';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { storagePath, uploadWithProgress } from '@/lib/storage';
import { onboardingKeys } from '../api';
import { completeOnboarding, setStartupLogo } from '../complete';
import {
  buildOnboardingPayload,
  emptyOnboardingValues,
  onboardingStepSchemas,
  type OnboardingFormValues,
} from '../schemas';

const STEPS = [
  { title: 'About you', description: 'Tell us who is building this startup.' },
  { title: 'Your startup', description: 'The basics innoWIUT will see on your startup profile.' },
  {
    title: 'Current progress',
    description: 'Where your startup is today. This becomes your first traction.',
  },
];

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

export function OnboardingPage() {
  useDocumentTitle('Set up your startup');
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoProgress, setLogoProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Validate only the current step's fields.
  const resolver: Resolver<OnboardingFormValues> = (values, context, options) => {
    const validateStep = zodResolver(onboardingStepSchemas[stepRef.current] as never, undefined, {
      raw: true,
    }) as unknown as Resolver<OnboardingFormValues>;
    return validateStep(values, context, options);
  };
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingFormValues>({
    resolver,
    defaultValues: emptyOnboardingValues(profile?.full_name ?? ''),
  });

  const hasUsers = useWatch({ control, name: 'has_users' });
  const hasRevenue = useWatch({ control, name: 'has_revenue' });

  const finish = useMutation({
    mutationFn: async (values: OnboardingFormValues) => {
      const startupId = await completeOnboarding(buildOnboardingPayload(values));
      let logoFailed = false;
      if (logo) {
        try {
          setLogoProgress(0);
          const path = await uploadWithProgress(
            'startup-logos',
            storagePath(startupId, 'logo', logo),
            logo,
            setLogoProgress,
          );
          await setStartupLogo(startupId, path);
        } catch {
          logoFailed = true;
        }
      }
      return { logoFailed };
    },
    onSuccess: async ({ logoFailed }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: onboardingKeys.all }),
        queryClient.invalidateQueries({ queryKey: founderKeys.startup(user?.id) }),
        queryClient.invalidateQueries({ queryKey: authKeys.profile(user?.id) }),
      ]);
      if (logoFailed)
        toast.warning(
          'Your startup is set up, but the logo did not upload. Add it from Startup Profile.',
        );
      else toast.success('Welcome to innoWIUT! Your startup is set up.');
      navigate(paths.founder.dashboard, { replace: true });
    },
    onError: async (error) => {
      setLogoProgress(null);
      if ((error as { code?: string }).code === 'P0001') {
        await queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
        navigate(paths.founder.dashboard, { replace: true });
        return;
      }
      setFormError(
        errorMessage(error, "We couldn't finish setting up your startup. Please try again."),
      );
    },
  });

  const goTo = (next: number) => {
    stepRef.current = next;
    setStep(next);
    setFormError(null);
    window.scrollTo({ top: 0 });
  };

  const onValid = (values: OnboardingFormValues) => {
    if (step < STEPS.length - 1) {
      goTo(step + 1);
      return;
    }
    setFormError(null);
    finish.mutate(values);
  };

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      navigate(paths.founderLogin, { replace: true });
    }
  }

  const busy = finish.isPending;
  const current = STEPS[step]!;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-8">
        <BrandMark subtitle="Founder Platform" />
        <Button variant="ghost" size="sm" loading={signingOut} onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
        <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Onboarding progress">
          {STEPS.map((item, index) => {
            const state = index < step ? 'done' : index === step ? 'current' : 'upcoming';
            return (
              <li
                key={item.title}
                aria-current={state === 'current' ? 'step' : undefined}
                className="space-y-2"
              >
                <div
                  className={cn(
                    'h-1 rounded-full',
                    state === 'upcoming' ? 'bg-line' : 'bg-primary',
                  )}
                />
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                      state === 'done' && 'bg-primary text-white',
                      state === 'current' && 'bg-primary-soft text-primary',
                      state === 'upcoming' && 'bg-line text-muted',
                    )}
                  >
                    {state === 'done' ? (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      'truncate text-[12px] font-medium',
                      state === 'upcoming' ? 'text-muted' : 'text-ink',
                      // Phones only have room for the current step's name.
                      state !== 'current' && 'hidden sm:inline',
                    )}
                  >
                    {item.title}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <form
          onSubmit={(event) => void handleSubmit(onValid)(event)}
          noValidate
          className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8"
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">
            {current.title}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">{current.description}</p>

          <div className="mt-6 space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}

            {step === 0 && (
              <>
                <TextField
                  label="Full name"
                  required
                  autoComplete="name"
                  error={errors.full_name?.message}
                  {...register('full_name')}
                />
                <TextField
                  label="Phone number"
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder="+998 90 123 45 67"
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
                <SelectField
                  label="Role in startup"
                  required
                  placeholder="Select your role"
                  options={FOUNDER_ROLES}
                  error={errors.role_in_startup?.message}
                  {...register('role_in_startup')}
                />
              </>
            )}

            {step === 1 && (
              <>
                <ImagePicker
                  label="Startup logo (optional)"
                  bucket="startup-logos"
                  file={logo}
                  onFileChange={setLogo}
                  disabled={busy}
                />
                <TextField
                  label="Startup name"
                  required
                  error={errors.name?.message}
                  {...register('name')}
                />
                <TextField
                  label="One-line description"
                  required
                  placeholder="What your startup does, in one sentence"
                  error={errors.tagline?.message}
                  {...register('tagline')}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    label="Industry"
                    required
                    placeholder="Select industry"
                    options={INDUSTRIES}
                    error={errors.industry?.message}
                    {...register('industry')}
                  />
                  <SelectField
                    label="Startup stage"
                    required
                    placeholder="Select stage"
                    options={STAGE_OPTIONS}
                    hint="Your Startup Journey starts here."
                    error={errors.stage?.message}
                    {...register('stage')}
                  />
                  <TextField
                    label="Founded year"
                    required
                    inputMode="numeric"
                    placeholder="2025"
                    error={errors.founded_year?.message}
                    {...register('founded_year')}
                  />
                  <TextField
                    label="Team size"
                    required
                    inputMode="numeric"
                    placeholder="3"
                    error={errors.team_size?.message}
                    {...register('team_size')}
                  />
                </div>
                <TextField
                  label="Website URL"
                  hint="Optional"
                  inputMode="url"
                  error={errors.website?.message}
                  {...register('website')}
                />
                <TextareaField
                  label="Longer description"
                  hint="Optional"
                  rows={4}
                  error={errors.description?.message}
                  {...register('description')}
                />
              </>
            )}

            {step === 2 && (
              <>
                <Controller
                  control={control}
                  name="has_product"
                  render={({ field }) => (
                    <ChoiceGroup
                      label="Do you have a working product?"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      options={YES_NO}
                      error={errors.has_product?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="has_users"
                  render={({ field }) => (
                    <ChoiceGroup
                      label="Do you currently have users?"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      options={YES_NO}
                      error={errors.has_users?.message}
                    />
                  )}
                />
                {hasUsers === 'yes' && (
                  <TextField
                    label="Current number of users"
                    required
                    inputMode="numeric"
                    error={errors.current_users?.message}
                    {...register('current_users')}
                  />
                )}
                <Controller
                  control={control}
                  name="has_revenue"
                  render={({ field }) => (
                    <ChoiceGroup
                      label="Do you have revenue?"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      options={YES_NO}
                      error={errors.has_revenue?.message}
                    />
                  )}
                />
                {hasRevenue === 'yes' && (
                  <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                    <TextField
                      label="Current monthly revenue"
                      required
                      inputMode="decimal"
                      error={errors.monthly_revenue?.message}
                      {...register('monthly_revenue')}
                    />
                    <SelectField
                      label="Currency"
                      required
                      placeholder="Select"
                      options={CURRENCIES}
                      error={errors.revenue_currency?.message}
                      {...register('revenue_currency')}
                    />
                  </div>
                )}
                <TextareaField
                  label="Current main goal"
                  required
                  error={errors.main_goal?.message}
                  {...register('main_goal')}
                />
                <TextareaField
                  label="Biggest current challenge"
                  required
                  error={errors.biggest_challenge?.message}
                  {...register('biggest_challenge')}
                />
                {logoProgress !== null && (
                  <p className="text-[12.5px] text-muted" role="status">
                    Uploading logo… {Math.round(logoProgress)}%
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <Button variant="outline" onClick={() => goTo(step - 1)} disabled={busy}>
                <ArrowLeft aria-hidden="true" /> Back
              </Button>
            ) : (
              <span aria-hidden="true" />
            )}
            <Button type="submit" loading={busy}>
              {step < STEPS.length - 1 ? (
                <>
                  Continue <ArrowRight aria-hidden="true" />
                </>
              ) : (
                'Complete setup'
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
