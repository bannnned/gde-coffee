import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const spacingPx: Record<string, number> = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

function resolveSpace(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value in spacingPx) return spacingPx[value];
  return undefined;
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ui-interactive ui-focus-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-on-accent shadow-surface hover:brightness-95",
        secondary: "border border-border bg-surface text-text shadow-surface hover:bg-card",
        ghost: "bg-transparent text-text hover:bg-surface",
        outline: "border border-border bg-transparent text-text hover:bg-surface",
        destructive: "bg-danger text-white hover:opacity-90",
        filled: "bg-accent text-on-accent shadow-surface hover:brightness-95",
        light: "border border-border bg-surface text-text shadow-surface hover:bg-card",
        subtle: "bg-transparent text-text hover:bg-surface",
      },
      size: {
        xs: "h-9 px-3",
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftSection?: React.ReactNode;
  fullWidth?: boolean;
  component?: "a" | "label";
  href?: string;
  target?: string;
  rel?: string;
  color?: string;
  mt?: unknown;
  mb?: unknown;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftSection,
      fullWidth = false,
      component,
      href,
      target,
      rel,
      disabled,
      color,
      style,
      mt,
      mb,
      children,
      ...props
    },
    ref,
  ) => {
    const computedVariant = color?.toLowerCase().startsWith("red")
      ? variant === "light" || variant === "outline" ? "outline" : "destructive"
      : variant;
    const classes = cn(
      buttonVariants({ variant: computedVariant, size, className }),
      fullWidth ? "w-full" : "",
      (disabled || loading) && component ? "pointer-events-none opacity-50" : "",
    );
    const marginTop = resolveSpace(mt);
    const marginBottom = resolveSpace(mb);
    const mergedStyle: React.CSSProperties = {
      ...(style ?? {}),
      ...(marginTop != null ? { marginTop } : null),
      ...(marginBottom != null ? { marginBottom } : null),
    };
    const content = (
      <>
        {loading ? (
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          leftSection
        )}
        {children}
      </>
    );

    if (component === "a") {
      return (
        <a
          className={classes}
          href={href}
          target={target}
          rel={rel}
          aria-disabled={disabled || loading ? "true" : undefined}
          style={mergedStyle}
          {...(props as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className">)}
        >
          {content}
        </a>
      );
    }

    if (component === "label") {
      return (
        <label
          className={classes}
          style={mergedStyle}
          {...(props as Omit<React.LabelHTMLAttributes<HTMLLabelElement>, "className">)}
        >
          {content}
        </label>
      );
    }

    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        style={mergedStyle}
        {...(props as Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">)}
      >
        {content}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
