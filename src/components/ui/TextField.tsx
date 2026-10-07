import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';

export const inputClasses =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-[13px] text-ink shadow-none outline-none transition-colors placeholder:text-subtle focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-canvas aria-invalid:border-danger aria-invalid:focus-visible:ring-danger';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Rendered at the right of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  error,
  hint,
  labelAction,
  required,
  className,
  id,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
        {labelAction}
      </div>
      <input
        id={inputId}
        className={inputClasses}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        required={required}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-[12px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
