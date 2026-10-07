import { Skeleton } from '@/components/ui/Skeleton';

export function MetricCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-busy="true"
      aria-label="Loading metrics"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-line bg-white p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return <Skeleton className="h-[240px] w-full rounded-xl" />;
}
