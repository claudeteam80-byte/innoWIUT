import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'positive' | 'warning' | 'danger' | 'blue' | 'neutral';

const tones: Record<BadgeTone, string> = {
  positive: 'bg-success-soft text-success-strong',
  warning: 'bg-warning-soft text-warning-strong',
  danger: 'bg-danger-soft text-danger-strong',
  blue: 'bg-primary-soft text-primary',
  neutral: 'bg-canvas text-muted',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
