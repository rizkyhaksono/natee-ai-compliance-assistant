import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  danger:
    "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  info:
    "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

export default function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
