import { useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { BrandMark } from '@/components/shared/BrandMark';
import { NotYetBuilt } from '@/components/shared/NotYetBuilt';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/useAuth';

const STEPS = ['About you', 'Your startup', 'Current progress'];

export function OnboardingPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      navigate(paths.founderLogin, { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-8">
        <BrandMark subtitle="Founder Platform" />
        <Button variant="ghost" size="sm" loading={signingOut} onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">Setup</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-ink">
          Set up your startup
        </h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Three short steps create your startup profile in innoWIUT.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Onboarding steps">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="flex items-center gap-3 rounded-xl border border-line bg-white p-3.5"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">
                {index + 1}
              </span>
              <span className="text-[13px] font-medium text-ink">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6">
          <NotYetBuilt feature="Onboarding" />
        </div>
      </main>
    </div>
  );
}
