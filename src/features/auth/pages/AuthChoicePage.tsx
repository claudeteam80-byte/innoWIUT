import { Link, Navigate } from 'react-router';
import { ArrowRight, Rocket, ShieldCheck } from 'lucide-react';
import { paths } from '@/app/paths';
import { BrandMark } from '@/components/shared/BrandMark';
import { buttonClasses } from '@/components/ui/button-styles';
import { useDocumentTitle } from '@/lib/document-title';
import { useSignedInRedirect } from '@/routes/guards/useSignedInRedirect';

export function AuthChoicePage() {
  useDocumentTitle(null);
  const redirectTo = useSignedInRedirect(true);
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <BrandMark subtitle="Founder Platform" />
          <h1 className="mt-8 text-[30px] font-semibold tracking-tight text-ink sm:text-[34px]">
            FounderTrack
          </h1>
          <p className="mt-2 max-w-md text-[14.5px] text-muted">
            The innoWIUT platform for startup founders and the team that supports them. Choose how
            you want to continue.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section
            aria-labelledby="founder-entry"
            className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <Rocket className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                For founders
              </span>
            </div>
            <h2 id="founder-entry" className="mt-5 text-[18px] font-semibold text-ink">
              Founder
            </h2>
            <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-muted">
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

          <section
            aria-labelledby="admin-entry"
            className="relative flex flex-col overflow-hidden rounded-2xl bg-navy p-6 text-white shadow-card sm:p-7"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/40 blur-3xl"
            />
            <div className="relative flex items-center justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">
                innoWIUT staff
              </span>
            </div>
            <h2 id="admin-entry" className="relative mt-5 text-[18px] font-semibold">
              innoWIUT Admin
            </h2>
            <p className="relative mt-1.5 flex-1 text-[13.5px] leading-relaxed text-white/65">
              Monitor startups, review traction and manage founder activity across the ecosystem.
            </p>
            <div className="relative mt-6">
              <Link
                to={paths.adminLogin}
                className={buttonClasses({
                  fullWidth: true,
                  className: 'bg-white text-navy hover:bg-white/90',
                })}
              >
                Admin Access
              </Link>
              <p className="mt-3 text-center text-[12px] text-white/50">
                Authorized personnel only · no public sign up
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
