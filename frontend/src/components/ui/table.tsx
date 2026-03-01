import { type CSSProperties, type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

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
