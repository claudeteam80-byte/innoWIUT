import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function InfoGrid({
  items,
}: {
  items: { label: string; value: ReactNode; wide?: boolean }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={cn(item.wide && 'sm:col-span-2')}>
          <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
            {item.label}
          </dt>
          <dd className="mt-1 whitespace-pre-line text-[13.5px] leading-6 text-ink">
            {item.value === null || item.value === undefined || item.value === '' ? (
              <span className="text-subtle">—</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
