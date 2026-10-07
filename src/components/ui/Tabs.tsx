import { cn } from '@/lib/cn';

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: readonly { value: T; label: string; count?: number }[];
  label: string;
  size?: 'md' | 'sm';
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  size = 'md',
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex rounded-lg border border-line bg-white p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              'rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-[13px]',
              selected ? 'bg-primary text-white' : 'text-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn('ml-1.5 text-[11.5px]', selected ? 'text-white/75' : 'text-subtle')}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
