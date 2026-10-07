import type { ReactNode } from 'react';
import { BrandMark } from '@/components/shared/BrandMark';

const FOOTER = 'innoWIUT · Westminster International University in Tashkent';

/** Split layout used by founder auth screens: brand panel left, form right. */
export function FounderAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/40 blur-3xl"
        />
        <BrandMark inverted subtitle="Founder Platform" className="relative" />
        <div className="relative max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            Your startup workspace
          </p>
          <p className="mt-4 text-[30px] font-semibold leading-tight">
            Track your startup.
            <br />
            Share progress.
          </p>
          <p className="mt-3 text-[15px] text-white/70">Stay connected with innoWIUT.</p>
        </div>
        <p className="relative text-[12px] text-white/45">{FOOTER}</p>
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <BrandMark subtitle="Founder Platform" className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <p className="text-center text-[12px] text-subtle lg:hidden">{FOOTER}</p>
      </main>
    </div>
  );
}

/** Centered card layout used by admin and shared auth screens. */
export function CardAuthLayout({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[440px]">
        <BrandMark subtitle={eyebrow} className="mb-6" />
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
