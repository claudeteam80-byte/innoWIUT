import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this. Check your connection and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border border-danger/20 bg-danger-soft/40 px-6 py-10 text-center"
    >
      <AlertCircle className="h-6 w-6 text-danger" aria-hidden="true" />
      <p className="mt-3 text-[14px] font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
