import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink-800">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full rounded border bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
            error
              ? 'border-danger focus:ring-danger/40'
              : 'border-ink-300 focus:border-ink-600 focus:ring-ink-200',
            'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
            className,
          ].join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-ink-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
