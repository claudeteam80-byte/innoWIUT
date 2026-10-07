import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { MetricChange } from '@/domain/traction';
import { cn } from '@/lib/cn';

const tones = {
  positive: 'bg-success-soft text-success-strong',
  negative: 'bg-danger-soft text-danger-strong',
  neutral: 'bg-canvas text-muted',
};

export function ChangePill({ change, className }: { change: MetricChange; className?: string }) {
  if (change.text === '—') return null;
  const Icon =
    change.tone === 'positive' ? TrendingUp : change.tone === 'negative' ? TrendingDown : Minus;
  const direction =
    change.tone === 'positive' ? 'up' : change.tone === 'negative' ? 'down' : 'unchanged';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
        tones[change.tone],
        className,
      )}
      aria-label={`${direction} ${change.text} since the previous value`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {change.text}
    </span>
  );
}
