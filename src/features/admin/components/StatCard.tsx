import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatNumber } from '@/domain/format';

interface StatCardProps {
  label: string;
  value: number | string | null | undefined;
  meta: string;
  icon: LucideIcon;
  loading?: boolean;
}

export function StatCard({ label, value, meta, icon: Icon, loading }: StatCardProps) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="flex min-h-10 items-start justify-between gap-3">
        <h3 className="text-[12.5px] font-medium text-muted">{label}</h3>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 text-[28px] font-semibold tracking-tight text-ink">
          {formatNumber(value ?? 0)}
        </p>
      )}
      <p className="mt-auto pt-2 text-[12px] text-subtle">{meta}</p>
    </article>
  );
}
