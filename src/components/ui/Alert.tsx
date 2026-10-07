import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'error' | 'success' | 'info';

const tones: Record<Tone, { className: string; icon: typeof Info }> = {
  error: { className: 'border-danger/20 bg-danger-soft text-danger-strong', icon: AlertCircle },
  success: {
    className: 'border-success/20 bg-success-soft text-success-strong',
    icon: CheckCircle2,
  },
  info: { className: 'border-primary/15 bg-primary-soft text-primary', icon: Info },
};

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const { className: toneClass, icon: Icon } = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] leading-5',
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
