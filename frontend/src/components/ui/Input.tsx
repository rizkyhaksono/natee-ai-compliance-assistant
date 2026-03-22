import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  const inputId = React.useId();
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:ring-zinc-600 ${
          error ? 'border-zinc-900 dark:border-zinc-200' : ''
        } ${className || ''}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  const selectId = React.useId();

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-600 ${
          className || ''
        }`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
