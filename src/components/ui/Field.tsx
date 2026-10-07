import {
  useId,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import { inputClasses } from './TextField';

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[12px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  return (
    [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function SelectField({
  label,
  options,
  placeholder,
  hint,
  error,
  required,
  className,
  id,
  ...props
}: SelectFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      <select
        id={fieldId}
        className={cn(
          inputClasses,
          'appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => {
          const { value, label: text } =
            typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextareaField({
  label,
  hint,
  error,
  required,
  className,
  id,
  rows = 3,
  ...props
}: TextareaFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      hint={hint}
      error={error}
      className={className}
    >
      <textarea
        id={fieldId}
        rows={rows}
        className={cn(inputClasses, 'h-auto min-h-[84px] py-2 leading-5')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...props}
      />
    </FieldShell>
  );
}
