import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

import { Input } from "../../../components/ui";
import { cn } from "../../../lib/utils";

type SwitchProps = {
  checked: boolean;
  onChange: (event: { currentTarget: { checked: boolean } }) => void;
  label?: ReactNode;
  className?: string;
};

export function Switch({ checked, onChange, label, className }: SwitchProps) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-text", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange({ currentTarget: { checked: !checked } })}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full border transition ui-focus-ring",
          checked ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]" : "border-border bg-surface",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white transition",
            checked ? "translate-x-[14px]" : "translate-x-[1px]",
          )}
        />
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  );
}

type TextInputProps = {
  label?: ReactNode;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "size">;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ label, description, required, className, style, ...rest }, ref) {
    return (
      <label className={cn("flex min-w-0 flex-col gap-1.5", className)} style={style}>
        {label ? (
          <span className="text-sm font-medium text-text">
            {label}
            {required ? <span className="ml-1 text-danger">*</span> : null}
          </span>
        ) : null}
        {description ? <span className="text-xs text-muted">{description}</span> : null}
        <Input ref={ref} {...rest} />
      </label>
    );
  },
);

type TextareaProps = {
  label?: ReactNode;
  description?: ReactNode;
  minRows?: number;
  autosize?: boolean;
  className?: string;
  style?: CSSProperties;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({
  label,
  description,
  minRows = 3,
  autosize = false,
  className,
  style,
  ...rest
}: TextareaProps) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)} style={style}>
      {label ? <span className="text-sm font-medium text-text">{label}</span> : null}
      {description ? <span className="text-xs text-muted">{description}</span> : null}
      <textarea
        rows={autosize ? undefined : minRows}
        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted shadow-surface ui-focus-ring"
        style={autosize ? { minHeight: `${minRows * 22}px` } : undefined}
        {...rest}
      />
    </label>
  );
}
