import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

type FormFieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-sm font-medium text-text">
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

type FormActionsProps = {
  className?: string;
  children: ReactNode;
};

export function FormActions({ className, children }: FormActionsProps) {
  return <div className={cn("flex items-center justify-end gap-2", className)}>{children}</div>;
}
