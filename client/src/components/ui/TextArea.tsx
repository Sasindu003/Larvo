import React from 'react';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const areaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={areaId} className="text-sm font-medium text-ink-800">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={[
            'w-full rounded border bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 resize-y min-h-[96px]',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
            error
              ? 'border-danger focus:ring-danger/40'
              : 'border-ink-300 focus:border-ink-600 focus:ring-ink-200',
            'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
            className,
          ].join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined}
          {...rest}
        />
        {error && (
          <p id={`${areaId}-error`} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${areaId}-hint`} className="text-xs text-ink-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';
