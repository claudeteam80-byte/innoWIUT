import { cn } from '@/lib/cn';

interface BrandMarkProps {
  subtitle?: string;
  inverted?: boolean;
  className?: string;
}

export function BrandMark({ subtitle, inverted = false, className }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-[13px] font-bold text-white"
      >
        iW
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn('text-[15px] font-semibold', inverted ? 'text-white' : 'text-ink')}>
          innoWIUT
        </span>
        {subtitle && (
          <span className={cn('text-[11.5px]', inverted ? 'text-white/55' : 'text-muted')}>
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}
