import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { Button as UIButton } from "../../../components/ui";
import { cn } from "../../../lib/utils";

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
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">;

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
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">;

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
  mt?: unknown;
  mb?: unknown;
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">;

export function Group({
  children,
  className,
  style,
  gap = "sm",
  justify,
  align,
  wrap = "wrap",
  mt,
  mb,
  ...rest
}: GroupProps) {
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
      {children}
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
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">;

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
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "children">;

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
} & Omit<HTMLAttributes<HTMLParagraphElement>, "style" | "children">;

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
        ...style,
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
} & Omit<HTMLAttributes<HTMLHeadingElement>, "style" | "children">;

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
  variant?: "default" | "secondary" | "outline" | "dot";
  color?: "yellow" | "green" | "red" | "orange" | "gray";
  radius?: unknown;
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
  radius = "xl",
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
        borderRadius: resolveRadius(radius) ?? 999,
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
  variant?: "transparent" | "light" | "filled";
  loading?: boolean;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "children">;

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
