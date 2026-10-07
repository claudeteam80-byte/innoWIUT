import { useId } from 'react';
import { cn } from '@/lib/cn';

interface ChoiceGroupProps<T extends string> {
  label: string;
  value: T | '' | undefined;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  error?: string;
  required?: boolean;
  name?: string;
}

/** Segmented radio group (e.g. Yes / No). Keyboard accessible via native radios. */
export function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  required,
  name,
}: ChoiceGroupProps<T>) {
  const id = useId();
  return (
    <fieldset className="space-y-1.5" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1.5 text-[13px] font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </legend>
      <div className="inline-flex w-full rounded-lg border border-line bg-canvas p-1 sm:w-auto">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'relative flex-1 cursor-pointer rounded-md px-5 py-2 text-center text-[13px] font-medium transition-colors sm:flex-none',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40',
              value === option.value
                ? 'bg-white text-primary shadow-card'
                : 'text-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name ?? id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
