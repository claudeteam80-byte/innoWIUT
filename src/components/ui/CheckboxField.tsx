import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function CheckboxField({ label, error, id, ...props }: CheckboxFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2.5">
        <input
          id={inputId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-primary"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        />
        <label htmlFor={inputId} className="text-[13px] leading-5 text-muted">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} className="text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
