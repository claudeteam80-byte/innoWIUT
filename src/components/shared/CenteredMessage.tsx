import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/document-title';
import { BrandMark } from './BrandMark';

export function CenteredMessage({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-card">
        <BrandMark />
        <h1 className="mt-6 text-[20px] font-semibold text-ink">{title}</h1>
        {children && <div className="mt-2 space-y-2 text-[13.5px] text-muted">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </main>
  );
}
