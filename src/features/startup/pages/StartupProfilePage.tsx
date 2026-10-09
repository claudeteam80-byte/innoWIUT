import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { INDUSTRIES } from '@/domain/options';
import { stageName } from '@/domain/journey';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { useAuth } from '@/features/auth/useAuth';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { updateStartup, type Startup } from '../api';
import { LogoUploader } from '../components/LogoUploader';
import { TeamSection } from '../components/TeamSection';
import { useMyStartup } from '../hooks';
import { startupProfileSchema, type StartupProfileInput } from '../schemas';

export function StartupProfilePage() {
  const startup = useMyStartup();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Startup Profile"
        title="Startup Profile"
        subtitle="Keep your company information and team accurate for innoWIUT."
      />
      {startup.isError ? (
        <ErrorState onRetry={() => void startup.refetch()} />
      ) : startup.isPending ? (
        <Card>
          <div className="space-y-4">
            <Skeleton className="h-20 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Company"
              description="These details appear on your startup summary and to the innoWIUT team."
            />
            <div className="mb-6">
              <LogoUploader startup={startup.data} />
            </div>
            <StartupForm key={startup.data.updated_at} startup={startup.data} />
          </Card>
          <TeamSection startupId={startup.data.id} />
        </>
      )}
    </div>
  );
}

function toFormValues(startup: Startup): StartupProfileInput {
  return {
    name: startup.name,
    tagline: startup.tagline ?? '',
    description: startup.description ?? '',
    industry: (startup.industry ?? '') as StartupProfileInput['industry'],
    website: startup.website ?? '',
    founded_year: startup.founded_year ? String(startup.founded_year) : '',
    team_size: startup.team_size ? String(startup.team_size) : '',
    main_goal: startup.main_goal ?? '',
    biggest_challenge: startup.biggest_challenge ?? '',
  };
}

function StartupForm({ startup }: { startup: Startup }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(startupProfileSchema),
    defaultValues: toFormValues(startup),
  });

  const save = useMutation({
    // Only editable columns are sent; owner and onboarding fields are never touched.
    mutationFn: (values: Parameters<typeof updateStartup>[1]) => updateStartup(startup.id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.startup(user?.id) });
      toast.success('Startup profile saved.');
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save your startup profile.")),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="grid gap-4 sm:grid-cols-2"
    >
      <TextField label="Startup name" required error={errors.name?.message} {...register('name')} />
      <TextField
        label="Website"
        hint="Optional"
        inputMode="url"
        error={errors.website?.message}
        {...register('website')}
      />
      <TextField
        label="Tagline"
        required
        className="sm:col-span-2"
        placeholder="One line on what you do"
        error={errors.tagline?.message}
        {...register('tagline')}
      />
      <TextareaField
        label="Description"
        hint="Optional"
        rows={4}
        className="sm:col-span-2"
        error={errors.description?.message}
        {...register('description')}
      />
      <SelectField
        label="Industry"
        required
        placeholder="Select industry"
        options={INDUSTRIES}
        error={errors.industry?.message}
        {...register('industry')}
      />
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium text-ink">Journey stage</p>
        <p className="flex h-10 items-center rounded-lg border border-line bg-canvas-subtle px-3 text-[13px] text-ink">
          {stageName(startup.journey_stage)}
        </p>
        <p className="text-[12px] text-muted">
          Stage moves are reviewed by innoWIUT.{' '}
          <Link to={paths.founder.journey} className="font-medium text-primary hover:underline">
            View your journey
          </Link>
        </p>
      </div>
      <TextField
        label="Founded year"
        required
        inputMode="numeric"
        error={errors.founded_year?.message}
        {...register('founded_year')}
      />
      <TextField
        label="Team size"
        required
        inputMode="numeric"
        error={errors.team_size?.message}
        {...register('team_size')}
      />
      <TextareaField
        label="Current main goal"
        required
        className="sm:col-span-2"
        error={errors.main_goal?.message}
        {...register('main_goal')}
      />
      <TextareaField
        label="Biggest current challenge"
        required
        className="sm:col-span-2"
        error={errors.biggest_challenge?.message}
        {...register('biggest_challenge')}
      />
      <div className="flex justify-end sm:col-span-2">
        <Button
          type="submit"
          loading={save.isPending}
          disabled={!isDirty}
          className="w-full sm:w-auto"
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}
