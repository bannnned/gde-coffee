import {
  Children,
  forwardRef,
  isValidElement,
  type CSSProperties,
  type ElementType,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import type * as React from "react";

import { AppSelect, type AppSelectProps } from "../bridge";
import { Button as UIButton, Input } from "../../components/ui";
import { cn } from "../../lib/utils";

const spacingPx: Record<string, number> = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

const radiusPx: Record<string, number> = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 22,
};

function resolveSpace(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value in spacingPx) return spacingPx[value];
  return undefined;
}

function resolveRadius(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value in radiusPx) return radiusPx[value];
  return undefined;
}

function withSpacingStyle(props: {
  p?: unknown;
  px?: unknown;
  py?: unknown;
  pb?: unknown;
  pt?: unknown;
  mt?: unknown;
  mb?: unknown;
  style?: CSSProperties;
}): CSSProperties {
  const style: CSSProperties = { ...(props.style ?? {}) };
  const p = resolveSpace(props.p);
  const px = resolveSpace(props.px);
  const py = resolveSpace(props.py);
  const pb = resolveSpace(props.pb);
  const pt = resolveSpace(props.pt);
  const mt = resolveSpace(props.mt);
  const mb = resolveSpace(props.mb);
  if (p != null) style.padding = p;
  if (px != null) {
    style.paddingLeft = px;
    style.paddingRight = px;
  }
  if (py != null) {
    style.paddingTop = py;
    style.paddingBottom = py;
  }
  if (pt != null) style.paddingTop = pt;
  if (pb != null) style.paddingBottom = pb;
  if (mt != null) style.marginTop = mt;
  if (mb != null) style.marginBottom = mb;
  return style;
}

type BoxProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  p?: unknown;
  px?: unknown;
  py?: unknown;
  pb?: unknown;
  pt?: unknown;
  mt?: unknown;
  mb?: unknown;
  pos?: CSSProperties["position"];
  h?: CSSProperties["height"];
  w?: CSSProperties["width"];
  left?: CSSProperties["left"];
  right?: CSSProperties["right"];
  top?: CSSProperties["top"];
  bottom?: CSSProperties["bottom"];
  inset?: CSSProperties["inset"];
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "children">;

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box(
  {
    children,
    className,
    style,
    p,
    px,
    py,
    pb,
    pt,
    mt,
    mb,
    pos,
    h,
    w,
    left,
    right,
    top,
    bottom,
    inset,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...withSpacingStyle({ p, px, py, pb, pt, mt, mb, style }),
        position: pos,
        height: h,
        width: w,
        left,
        right,
        top,
        bottom,
        inset,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

type ContainerProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  size?: "xs" | "sm" | "md" | "lg" | number | string;
  py?: unknown;
  px?: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "children">;

export function Container({
  children,
  className,
  style,
  size = "md",
  py,
  px,
  ...rest
}: ContainerProps) {
  const width =
    typeof size === "number"
      ? `${size}px`
      : size === "xs"
        ? "420px"
        : size === "sm"
          ? "640px"
          : size === "lg"
            ? "1080px"
            : size === "md"
              ? "860px"
              : size;
  return (
    <div
      className={className}
      style={{
        width: "min(100%, 100%)",
        maxWidth: width,
        marginInline: "auto",
        ...withSpacingStyle({ py, px, style }),
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

type GroupProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  gap?: unknown;
  justify?: CSSProperties["justifyContent"];
  align?: CSSProperties["alignItems"];
  wrap?: CSSProperties["flexWrap"];
  grow?: boolean;
  mt?: unknown;
  mb?: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "children">;

export function Group({
  children,
  className,
  style,
  gap = "sm",
  justify,
  align,
  wrap = "wrap",
  grow = false,
  mt,
  mb,
  ...rest
}: GroupProps) {
  const items = Children.toArray(children);
  const gapPx = resolveSpace(gap) ?? 0;
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexWrap: wrap,
        justifyContent: justify,
        alignItems: align,
        gap: gapPx,
        ...withSpacingStyle({ mt, mb, style }),
      }}
      {...rest}
    >
      {grow
        ? items.map((child, index) => {
            if (!isValidElement(child)) {
              return (
                <div key={`group-item-${index}`} style={{ flex: 1, minWidth: 0 }}>
                  {child}
                </div>
              );
            }
            return (
              <div key={child.key ?? `group-item-${index}`} style={{ flex: 1, minWidth: 0 }}>
                {child}
              </div>
            );
          })
        : items}
    </div>
  );
}

type StackProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  gap?: unknown;
  align?: CSSProperties["alignItems"];
  mt?: unknown;
  mb?: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "children">;

export function Stack({
  children,
  className,
  style,
  gap = "sm",
  align,
  mt,
  mb,
  ...rest
}: StackProps) {
  const gapPx = resolveSpace(gap) ?? 0;
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gap: gapPx,
        alignItems: align,
        ...withSpacingStyle({ mt, mb, style }),
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

type PaperProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  withBorder?: boolean;
  radius?: unknown;
  p?: unknown;
  px?: unknown;
  py?: unknown;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "children">;

export function Paper({
  children,
  className,
  style,
  withBorder = false,
  radius = "md",
  p,
  px,
  py,
  ...rest
}: PaperProps) {
  const radiusValue = resolveRadius(radius) ?? 12;
  return (
    <div
      className={className}
      style={{
        borderRadius: radiusValue,
        border: withBorder ? "1px solid var(--border)" : "none",
        background: "var(--surface)",
        ...withSpacingStyle({ p, px, py, style }),
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

type TextProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  c?: string;
  fw?: number;
  size?: string | number;
  ta?: CSSProperties["textAlign"];
  tt?: "uppercase" | "lowercase" | "capitalize";
  lineClamp?: number;
  mt?: unknown;
  mb?: unknown;
} & Omit<React.HTMLAttributes<HTMLParagraphElement>, "style" | "children">;

function mapColor(value: string): string {
  if (value === "dimmed") return "var(--muted)";
  if (value === "red") return "var(--color-status-error)";
  if (value === "green") return "var(--color-status-success)";
  if (value === "orange") return "var(--color-status-warning)";
  if (value.startsWith("red")) return "var(--color-status-error)";
  return "var(--text)";
}

export function Text({
  children,
  className,
  style,
  c,
  fw,
  size,
  ta,
  tt,
  lineClamp,
  mt,
  mb,
  ...rest
}: TextProps) {
  const fontSize =
    typeof size === "number"
      ? size
      : size === "xs"
        ? 12
        : size === "sm"
          ? 13
          : size === "xl"
            ? 28
            : 14;
  return (
    <p
      className={className}
      style={{
        margin: 0,
        color: c ? mapColor(c) : "var(--text)",
        fontWeight: fw,
        fontSize,
        textAlign: ta,
        textTransform: tt,
        ...(lineClamp
          ? {
              display: "-webkit-box",
              WebkitBoxOrient: "vertical" as const,
              WebkitLineClamp: lineClamp,
              overflow: "hidden",
            }
          : null),
        ...withSpacingStyle({ mt, mb, style }),
      }}
      {...rest}
    >
      {children}
    </p>
  );
}

type TitleProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  order?: 1 | 2 | 3 | 4 | 5 | 6;
  mt?: unknown;
  mb?: unknown;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, "style" | "children">;

export function Title({
  children,
  className,
  style,
  order = 3,
  mt,
  mb,
  ...rest
}: TitleProps) {
  const Tag = `h${order}` as ElementType;
  const fontSizeMap: Record<number, number> = { 1: 36, 2: 30, 3: 24, 4: 20, 5: 18, 6: 16 };
  return (
    <Tag
      className={className}
      style={{
        margin: 0,
        color: "var(--text)",
        fontWeight: 700,
        fontSize: fontSizeMap[order] ?? 24,
        ...withSpacingStyle({ mt, mb, style }),
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type BadgeProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: "filled" | "light" | "outline" | "dot";
  color?: "yellow" | "green" | "red" | "orange" | "gray";
  radius?: unknown;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "style" | "children">;

function badgeColor(color?: BadgeProps["color"]) {
  if (color === "green") return "var(--color-status-success)";
  if (color === "red") return "var(--color-status-error)";
  if (color === "orange") return "var(--color-status-warning)";
  if (color === "yellow") return "var(--color-status-warning)";
  return "color-mix(in srgb, var(--muted) 45%, var(--surface))";
}

export function Badge({
  children,
  className,
  style,
  variant = "filled",
  color,
  radius = "xl",
  ...rest
}: BadgeProps) {
  const tone = badgeColor(color);
  const radiusValue = resolveRadius(radius) ?? 999;
  const background =
    variant === "outline"
      ? "transparent"
      : variant === "light" || variant === "dot"
        ? "color-mix(in srgb, var(--surface) 72%, transparent)"
        : tone;
  const textColor = variant === "filled" ? "var(--color-on-accent)" : "var(--text)";
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: variant === "dot" ? 6 : 0,
        borderRadius: radiusValue,
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

type LoaderProps = {
  size?: number | string;
};

export function Loader({ size = 16 }: LoaderProps) {
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
  className?: string;
  style?: CSSProperties;
  variant?: "filled" | "light" | "subtle" | "default";
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  leftSection?: ReactNode;
  fullWidth?: boolean;
  component?: ElementType;
  href?: string;
  target?: string;
  rel?: string;
  mt?: unknown;
  mb?: unknown;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children"> &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "style" | "children">;

export function Button({
  children,
  className,
  style,
  variant = "filled",
  size = "md",
  loading = false,
  disabled = false,
  leftSection,
  fullWidth = false,
  component,
  href,
  target,
  rel,
  color,
  mt,
  mb,
  ...rest
}: ButtonProps) {
  const mappedVariant =
    variant === "light" || variant === "default"
      ? "secondary"
      : variant === "subtle"
        ? "ghost"
        : "default";
  const mappedSize = size === "xs" || size === "sm" ? "sm" : size === "lg" ? "lg" : "md";
  const toneStyle: CSSProperties | undefined = color?.startsWith("red")
    ? mappedVariant === "default"
      ? {
          background: "var(--color-status-error)",
          borderColor: "var(--color-status-error)",
          color: "var(--color-on-accent)",
        }
      : {
          borderColor: "var(--color-status-error)",
          color: "var(--color-status-error)",
        }
    : undefined;
  const mergedStyle = {
    ...withSpacingStyle({ mt, mb, style }),
    ...(toneStyle ?? {}),
  };
  const content = (
    <>
      {loading ? <Loader size={14} /> : leftSection}
      {children}
    </>
  );
  if (component === "a") {
    return (
      <a
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ui-focus-ring",
          mappedVariant === "default"
            ? "bg-accent text-on-accent"
            : mappedVariant === "secondary"
              ? "border border-border bg-surface text-text"
              : "bg-transparent text-text",
          fullWidth ? "w-full" : "",
          className,
        )}
        style={mergedStyle}
        href={href}
        target={target}
        rel={rel}
        {...(rest as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children">)}
      >
        {content}
      </a>
    );
  }
  if (component === "label") {
    return (
      <label
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ui-focus-ring",
          mappedVariant === "default"
            ? "bg-accent text-on-accent"
            : mappedVariant === "secondary"
              ? "border border-border bg-surface text-text"
              : "bg-transparent text-text",
          fullWidth ? "w-full" : "",
          className,
        )}
        style={mergedStyle}
        {...(rest as Omit<React.LabelHTMLAttributes<HTMLLabelElement>, "children">)}
      >
        {content}
      </label>
    );
  }
  return (
    <UIButton
      className={cn(fullWidth ? "w-full" : "", className)}
      style={mergedStyle}
      variant={mappedVariant}
      size={mappedSize}
      disabled={disabled || loading}
      {...(rest as Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">)}
    >
      {content}
    </UIButton>
  );
}

type ActionIconProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  size?: number;
  variant?: "transparent" | "light" | "filled";
  loading?: boolean;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children">;

export function ActionIcon({
  children,
  className,
  style,
  size = 36,
  variant = "transparent",
  loading = false,
  disabled = false,
  ...rest
}: ActionIconProps) {
  const mappedVariant = variant === "light" ? "secondary" : variant === "filled" ? "default" : "ghost";
  return (
    <UIButton
      size="icon"
      variant={mappedVariant}
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
  fullWidth?: boolean;
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
  fullWidth = true,
  styles,
}: SegmentedControlProps) {
  return (
    <div
      style={{
        display: "flex",
        width: fullWidth ? "100%" : "max-content",
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

type SelectProps = AppSelectProps & {
  label?: ReactNode;
  description?: ReactNode;
  w?: number;
  style?: CSSProperties;
  mt?: unknown;
  mb?: unknown;
};

export function Select({
  label,
  description,
  w,
  className,
  style,
  mt,
  mb,
  styles,
  ...rest
}: SelectProps) {
  return (
    <label
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      style={{
        ...(w ? { width: w } : null),
        ...withSpacingStyle({ mt, mb, style }),
      }}
    >
      {label ? <span className="text-sm font-medium text-text">{label}</span> : null}
      {description ? <span className="text-xs text-muted">{description}</span> : null}
      <AppSelect
        implementation="radix"
        styles={styles}
        {...rest}
      />
    </label>
  );
}

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
          checked
            ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]"
            : "border-border bg-surface",
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

type AlertProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  icon?: ReactNode;
  color?: "red" | "blue" | "orange" | "green";
  variant?: "light" | "filled";
  title?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "children">;

export function Alert({
  children,
  className,
  style,
  icon,
  color = "blue",
  variant = "light",
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
        background:
          variant === "filled"
            ? tone
            : "color-mix(in srgb, var(--surface) 82%, transparent)",
        color: variant === "filled" ? "var(--color-on-accent)" : "var(--text)",
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
type TableTheadProps = TableSectionProps & React.HTMLAttributes<HTMLTableSectionElement>;
type TableTbodyProps = TableSectionProps & React.HTMLAttributes<HTMLTableSectionElement>;
type TableTrProps = TableSectionProps & React.HTMLAttributes<HTMLTableRowElement>;
type TableThProps = TableSectionProps & React.ThHTMLAttributes<HTMLTableCellElement>;
type TableTdProps = TableSectionProps & React.TdHTMLAttributes<HTMLTableCellElement>;

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
