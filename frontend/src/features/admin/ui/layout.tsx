import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";

import { Button as UIButton } from "../../../components/ui";

function Spinner({ size = 16 }: { size?: number | string }) {
  const dim = typeof size === "number" ? size : Number(size) || 16;
  return (
    <span
      aria-hidden="true"
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: dim, height: dim }}
    />
  );
}

type ButtonProps = {
  children?: ReactNode;
  variant?: "default" | "secondary" | "ghost" | "outline" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({
  children,
  variant = "default",
  size = "md",
  loading = false,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <UIButton
      variant={variant}
      size={size}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : null}
      {children}
    </UIButton>
  );
}

type ActionIconProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  size?: number;
  variant?: "default" | "secondary" | "ghost" | "outline" | "destructive";
  loading?: boolean;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children">;

export function ActionIcon({
  children,
  className,
  style,
  size = 36,
  variant = "ghost",
  loading = false,
  disabled = false,
  ...rest
}: ActionIconProps) {
  return (
    <UIButton
      size="icon"
      variant={variant}
      className={className}
      style={{ width: size, height: size, ...style }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : children}
    </UIButton>
  );
}
