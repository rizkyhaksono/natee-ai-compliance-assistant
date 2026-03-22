import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-medium transition-all rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black';

  const variants = {
    primary: 'bg-black text-white hover:bg-zinc-800 focus:ring-zinc-500 dark:bg-white dark:text-black dark:hover:bg-zinc-300',
    secondary: 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 focus:ring-zinc-400 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600',
    danger: 'bg-zinc-900 text-white hover:bg-zinc-700 focus:ring-zinc-500 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300',
    outline: 'border-2 border-zinc-300 text-zinc-900 hover:bg-zinc-50 focus:ring-zinc-400 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-800',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
}
