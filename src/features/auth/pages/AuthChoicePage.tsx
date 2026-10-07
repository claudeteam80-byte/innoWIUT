import { Link, Navigate } from 'react-router';
import { ArrowRight, Rocket, ShieldCheck } from 'lucide-react';
import { paths } from '@/app/paths';
import { BrandMark } from '@/components/shared/BrandMark';
import { buttonClasses } from '@/components/ui/button-styles';
import { useSignedInRedirect } from '@/routes/guards/useSignedInRedirect';

export function AuthChoicePage() {
  const redirectTo = useSignedInRedirect(true);
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <BrandMark subtitle="Startup Platform Access" />
          <h1 className="mt-8 text-[28px] font-semibold tracking-tight text-ink">
            Welcome to innoWIUT
          </h1>
          <p className="mt-2 text-[14px] text-muted">Choose how you want to continue.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
              <Rocket className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-ink">Founder</h2>
            <p className="mt-1 flex-1 text-[13px] text-muted">
              Build your startup profile, update traction, share progress and connect with your
              mentor.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link to={paths.founderSignup} className={buttonClasses({ fullWidth: true })}>
                Create Founder Account <ArrowRight aria-hidden="true" />
              </Link>
              <Link
                to={paths.founderLogin}
                className={buttonClasses({ variant: 'outline', fullWidth: true })}
              >
                Founder Sign In
              </Link>
            </div>
          </section>

          <section className="flex flex-col rounded-2xl border border-line bg-navy p-6 text-white shadow-card">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold">innoWIUT Admin</h2>
            <p className="mt-1 flex-1 text-[13px] text-white/65">
              Monitor startups, review traction and manage founder activity across the ecosystem.
            </p>
            <div className="mt-6">
              <Link
                to={paths.adminLogin}
                className={buttonClasses({
                  fullWidth: true,
                  className: 'bg-white text-navy hover:bg-white/90',
                })}
              >
                Admin Access
              </Link>
              <p className="mt-2 text-center text-[12px] text-white/50">
                Authorized personnel only
              </p>
            </div>
          </section>
        </div>

        <p className="mt-10 text-center text-[12px] text-subtle">
          innoWIUT · Westminster International University in Tashkent
        </p>
      </div>
    </main>
  );
}
