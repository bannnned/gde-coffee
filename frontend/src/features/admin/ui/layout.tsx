import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { Button as UIButton } from "../../../components/ui";
import { cn } from "../../../lib/utils";

type BadgeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: "default" | "secondary" | "outline" | "dot";
  color?: "yellow" | "green" | "red" | "orange" | "gray";
} & Omit<HTMLAttributes<HTMLSpanElement>, "style" | "children">;

function badgeTone(color?: BadgeProps["color"]): string {
  if (color === "green") return "var(--color-status-success)";
  if (color === "red") return "var(--color-status-error)";
  if (color === "orange" || color === "yellow") return "var(--color-status-warning)";
  return "color-mix(in srgb, var(--muted) 45%, var(--surface))";
}

export function Badge({
  children,
  className,
  style,
  variant = "default",
  color,
  ...rest
}: BadgeProps) {
  const tone = badgeTone(color);
  const isSoft = variant === "secondary" || variant === "dot";
  const isSolid = variant === "default";
  const isLowContrastTone = color === "yellow" || color === "gray";
  const textColor = isSolid
    ? isLowContrastTone
      ? "var(--text)"
      : "var(--color-on-accent)"
    : "var(--text)";
  const background =
    variant === "outline"
      ? "transparent"
      : isSoft
        ? "color-mix(in srgb, var(--surface) 72%, transparent)"
        : tone;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: variant === "dot" ? 6 : 0,
        borderRadius: 999,
        border: `1px solid ${tone}`,
        background,
        color: textColor,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 8px",
        ...style,
      }}
      {...rest}
    >
      {variant === "dot" ? (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: tone,
            display: "inline-block",
          }}
        />
      ) : null}
      {children}
    </span>
  );
}

export function Loader({ size = 16 }: { size?: number | string }) {
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
      {loading ? <Loader size={14} /> : null}
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
      {loading ? <Loader size={14} /> : children}
    </UIButton>
  );
}

type SegmentedControlProps = {
  value: string;
  onChange: (value: string) => void;
  data: Array<{ value: string; label: string }>;
  styles?: {
    root?: CSSProperties;
    indicator?: CSSProperties;
    label?: CSSProperties;
  };
};

export function SegmentedControl({
  value,
  onChange,
  data,
  styles,
}: SegmentedControlProps) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        padding: 4,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        ...styles?.root,
      }}
    >
      {data.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            className="ui-focus-ring"
            onClick={() => onChange(item.value)}
            style={{
              border: "none",
              background: active
                ? "var(--color-brand-accent)"
                : "transparent",
              color: active ? "var(--color-on-accent)" : "var(--text)",
              fontWeight: 600,
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              ...styles?.label,
              ...(active ? styles?.indicator : null),
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

type AlertProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  icon?: ReactNode;
  color?: "red" | "blue" | "orange" | "green";
  title?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">;

export function Alert({
  children,
  className,
  style,
  icon,
  color = "blue",
  title,
  ...rest
}: AlertProps) {
  const tone =
    color === "red"
      ? "var(--color-status-error)"
      : color === "green"
        ? "var(--color-status-success)"
        : color === "orange"
          ? "var(--color-status-warning)"
          : "var(--color-status-info)";
  return (
    <div
      className={cn("rounded-[14px] border px-3 py-2", className)}
      style={{
        borderColor: tone,
        background: "color-mix(in srgb, var(--surface) 82%, transparent)",
        color: "var(--text)",
        ...style,
      }}
      {...rest}
    >
      <div className="flex items-start gap-2">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0">
          {title ? <p className="m-0 text-sm font-semibold">{title}</p> : null}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

type TableProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  striped?: boolean;
  withTableBorder?: boolean;
  withColumnBorders?: boolean;
  highlightOnHover?: boolean;
};

type TableSectionProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};
type TableTheadProps = TableSectionProps & HTMLAttributes<HTMLTableSectionElement>;
type TableTbodyProps = TableSectionProps & HTMLAttributes<HTMLTableSectionElement>;
type TableTrProps = TableSectionProps & HTMLAttributes<HTMLTableRowElement>;
type TableThProps = TableSectionProps & ThHTMLAttributes<HTMLTableCellElement>;
type TableTdProps = TableSectionProps & TdHTMLAttributes<HTMLTableCellElement>;

function TableRoot({
  children,
  className,
  style,
  striped,
  withTableBorder,
  withColumnBorders,
  highlightOnHover,
}: TableProps) {
  return (
    <div className={cn("w-full overflow-auto", className)} style={style}>
      <table
        className={cn("w-full border-collapse text-sm text-text")}
        style={{
          border: withTableBorder ? "1px solid var(--border)" : undefined,
        }}
        data-column-borders={withColumnBorders ? "true" : "false"}
        data-striped={striped ? "true" : "false"}
        data-hover={highlightOnHover ? "true" : "false"}
      >
        {children}
      </table>
    </div>
  );
}

function TableThead({ children, className, style, ...rest }: TableTheadProps) {
  return (
    <thead className={className} style={style} {...rest}>
      {children}
    </thead>
  );
}

function TableTbody({ children, className, style, ...rest }: TableTbodyProps) {
  return (
    <tbody className={className} style={style} {...rest}>
      {children}
    </tbody>
  );
}

function TableTr({ children, className, style, ...rest }: TableTrProps) {
  return (
    <tr className={className} style={style} {...rest}>
      {children}
    </tr>
  );
}

function TableTh({ children, className, style, ...rest }: TableThProps) {
  return (
    <th
      className={className}
      style={{
        borderBottom: "1px solid var(--border)",
        textAlign: "left",
        padding: "8px 10px",
        fontWeight: 700,
        ...style,
      }}
      {...rest}
    >
      {children}
    </th>
  );
}

function TableTd({ children, className, style, ...rest }: TableTdProps) {
  return (
    <td
      className={className}
      style={{
        borderBottom: "1px solid color-mix(in srgb, var(--border) 72%, transparent)",
        padding: "8px 10px",
        verticalAlign: "top",
        ...style,
      }}
      {...rest}
    >
      {children}
    </td>
  );
}

type TableComposite = typeof TableRoot & {
  Thead: typeof TableThead;
  Tbody: typeof TableTbody;
  Tr: typeof TableTr;
  Th: typeof TableTh;
  Td: typeof TableTd;
};

export const Table = TableRoot as TableComposite;
Table.Thead = TableThead;
Table.Tbody = TableTbody;
Table.Tr = TableTr;
Table.Th = TableTh;
Table.Td = TableTd;
