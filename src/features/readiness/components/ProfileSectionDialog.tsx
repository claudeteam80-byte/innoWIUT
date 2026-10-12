import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/ChoiceGroup';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextareaField } from '@/components/ui/Field';
import { TextField } from '@/components/ui/TextField';
import { CURRENCIES } from '@/domain/options';
import {
  BUSINESS_TYPES,
  COMMITMENTS,
  PRODUCT_STAGES,
  ROUND_TYPES,
  type ReadinessProfile,
} from '@/domain/readiness';
import { founderKeys } from '@/features/founder-keys';
import { errorMessage } from '@/lib/errors';
import { updateReadinessProfile } from '../api';
import {
  profilePatch,
  readinessProfileSchema,
  toProfileForm,
  type ProfileGroup,
  type ReadinessProfileInput,
} from '../schemas';

const TITLES: Record<ProfileGroup, { title: string; description: string }> = {
  company: {
    title: 'Company & product details',
    description: 'Your startup name, industry and website come from your startup profile.',
  },
  team: {
    title: 'Founder details',
    description: 'Team members’ experience and commitment are edited on your startup profile.',
  },
  fundraising: {
    title: 'Fundraising',
    description: 'The round you are preparing. Leave anything you have not decided empty.',
  },
  legal: { title: 'Legal & Operations', description: 'What an investor checks first.' },
};

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  group: ProfileGroup | null;
  profile: ReadinessProfile | null;
}

export function ProfileSectionDialog(props: Props) {
  return props.open && props.group ? <ProfileForm key={props.group} {...props} /> : null;
}

function ProfileForm({ open, onOpenChange, startupId, group, profile }: Props) {
  const queryClient = useQueryClient();
  const g = group!;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReadinessProfileInput, unknown, Parameters<typeof profilePatch>[1]>({
    resolver: zodResolver(readinessProfileSchema),
    defaultValues: toProfileForm(profile),
  });

  const save = useMutation({
    mutationFn: (values: Parameters<typeof profilePatch>[1]) =>
      updateReadinessProfile(startupId, profilePatch(g, values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: founderKeys.readiness(startupId) });
      toast.success(`${TITLES[g].title} saved.`);
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error, "We couldn't save these details.")),
  });

  const yesNo = (name: keyof ReadinessProfileInput, label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChoiceGroup
          label={label}
          value={field.value as 'yes' | 'no' | ''}
          onChange={field.onChange}
          options={YES_NO}
          error={errors[name]?.message}
        />
      )}
    />
  );

  const fundraising = useWatch({ control, name: 'is_fundraising' });
  const registered = useWatch({ control, name: 'company_registered' });
  const blockers = useWatch({ control, name: 'has_legal_blockers' });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={TITLES[g].title}
      description={TITLES[g].description}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="readiness-profile-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="readiness-profile-form"
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit((values) => save.mutate(values))}
      >
        {g === 'company' && (
          <>
            <SelectField
              label="Business type"
              placeholder="Choose…"
              options={BUSINESS_TYPES}
              error={errors.business_type?.message}
              {...register('business_type')}
            />
            <SelectField
              label="Current product stage"
              placeholder="Choose…"
              options={PRODUCT_STAGES}
              error={errors.product_stage?.message}
              {...register('product_stage')}
            />
          </>
        )}

        {g === 'team' && (
          <>
            <TextareaField
              label="Your relevant experience"
              className="sm:col-span-2"
              rows={4}
              maxLength={2000}
              error={errors.founder_experience?.message}
              {...register('founder_experience')}
            />
            <SelectField
              label="Your commitment"
              placeholder="Choose…"
              options={COMMITMENTS}
              error={errors.founder_commitment?.message}
              {...register('founder_commitment')}
            />
          </>
        )}

        {g === 'fundraising' && (
          <>
            <div className="sm:col-span-2">{yesNo('is_fundraising', 'Currently fundraising?')}</div>
            {fundraising !== 'no' && (
              <>
                <SelectField
                  label="Round type"
                  placeholder="Choose…"
                  options={ROUND_TYPES}
                  error={errors.round_type?.message}
                  {...register('round_type')}
                />
                <div className="grid grid-cols-[1fr_7rem] gap-2">
                  <TextField
                    label="Target raise"
                    inputMode="decimal"
                    error={errors.target_raise?.message}
                    {...register('target_raise')}
                  />
                  <SelectField
                    label="Currency"
                    placeholder="—"
                    options={CURRENCIES}
                    error={errors.raise_currency?.message}
                    {...register('raise_currency')}
                  />
                </div>
                <TextareaField
                  label="Use of funds"
                  className="sm:col-span-2"
                  maxLength={2000}
                  error={errors.use_of_funds?.message}
                  {...register('use_of_funds')}
                />
                <TextField
                  label="Runway (months)"
                  inputMode="numeric"
                  error={errors.runway_months?.message}
                  {...register('runway_months')}
                />
                <TextField
                  label="Valuation"
                  hint="Optional · same currency as the target raise"
                  inputMode="decimal"
                  error={errors.valuation?.message}
                  {...register('valuation')}
                />
                <TextareaField
                  label="Previous funding"
                  hint="Grants, angels or rounds so far — or “None”."
                  maxLength={1000}
                  error={errors.previous_funding?.message}
                  {...register('previous_funding')}
                />
                <TextareaField
                  label="Target outcome of this round"
                  maxLength={1000}
                  error={errors.round_outcome?.message}
                  {...register('round_outcome')}
                />
              </>
            )}
          </>
        )}

        {g === 'legal' && (
          <>
            <div className="sm:col-span-2">
              {yesNo('company_registered', 'Is the company registered?')}
            </div>
            {registered !== 'no' && (
              <>
                <TextField
                  label="Jurisdiction"
                  placeholder="e.g. Uzbekistan"
                  error={errors.jurisdiction?.message}
                  {...register('jurisdiction')}
                />
                <TextField
                  label="Legal entity name"
                  error={errors.legal_entity_name?.message}
                  {...register('legal_entity_name')}
                />
              </>
            )}
            {yesNo('cap_table_prepared', 'Cap table prepared?')}
            {yesNo('ip_ownership_clear', 'Does the company clearly own its IP?')}
            <div className="sm:col-span-2">
              {yesNo('has_legal_blockers', 'Any major legal blockers?')}
            </div>
            {blockers === 'yes' && (
              <TextareaField
                label="Describe the blockers"
                className="sm:col-span-2"
                maxLength={1000}
                error={errors.legal_blockers_note?.message}
                {...register('legal_blockers_note')}
              />
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}
