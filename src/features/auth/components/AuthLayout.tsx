import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, FileText, ShieldCheck, TrendingUp, UserRound } from 'lucide-react';
import { paths } from '@/app/paths';
import { BrandMark } from '@/components/shared/BrandMark';
import { useDocumentTitle } from '@/lib/document-title';

const FOOTER = 'innoWIUT · Westminster International University in Tashkent';

const FOUNDER_POINTS = [
  { icon: TrendingUp, text: 'Record your traction and see the trend' },
  { icon: FileText, text: 'Share progress updates with innoWIUT' },
  { icon: UserRound, text: 'Work with your assigned mentor' },
];

function BackToAccessOptions({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      to={paths.authChoice}
      className={
        inverted
          ? 'inline-flex items-center gap-1.5 rounded-md py-1 text-[12.5px] font-medium text-white/60 hover:text-white'
          : 'inline-flex items-center gap-1.5 rounded-md py-1 text-[12.5px] font-medium text-muted hover:text-ink'
      }
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Access options
    </Link>
  );
}

/** Split layout used by founder auth screens: brand panel left, form right. */
export function FounderAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl"
        />
        <BrandMark inverted subtitle="FounderTrack · Founder Platform" className="relative" />
        <div className="relative max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Your startup workspace
          </p>
          <p className="mt-4 text-[30px] font-semibold leading-tight">
            Track your startup.
            <br />
            Share progress.
          </p>
          <ul className="mt-8 space-y-3">
            {FOUNDER_POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14px] text-white/75">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] text-white/45">{FOOTER}</p>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <BrandMark subtitle="FounderTrack · Founder Platform" className="lg:hidden" />
          <div className="ml-auto">
            <BackToAccessOptions />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <p className="text-center text-[12px] text-subtle lg:hidden">{FOOTER}</p>
      </main>
    </div>
  );
}

/**
 * Dark "Admin Console" layout for innoWIUT staff screens, so the admin entrance is never
 * mistaken for the founder one.
 */
export function AdminAuthLayout({ children }: { children: ReactNode; eyebrow?: string }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-primary/35 blur-3xl"
      />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <BrandMark inverted subtitle="FounderTrack" />
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/80">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Admin Console
          </span>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.55)] sm:p-8">
          {children}
        </div>
        <div className="mt-6 flex flex-col items-center gap-2 text-center">
          <BackToAccessOptions inverted />
          <p className="text-[12px] text-white/40">{FOOTER}</p>
        </div>
      </div>
    </main>
  );
}

/** Centered card layout used by shared auth screens (password reset). */
export function CardAuthLayout({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-between gap-3">
          <BrandMark subtitle={eyebrow ?? 'FounderTrack'} />
          <BackToAccessOptions />
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-[12px] text-subtle">{FOOTER}</p>
      </div>
    </main>
  );
}

export function AuthHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  useDocumentTitle(title);
  return (
    <div className="mb-6">
      {eyebrow && (
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[13.5px] text-muted">{subtitle}</p>}
    </div>
  );
}
