import * as React from "react";

import { cn } from "../../lib/utils";

export interface SpinnerProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: number | string;
}

function Spinner({ size = 14, className, style, ...props }: SpinnerProps) {
  const dim = typeof size === "number" ? size : Number(size) || 14;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      style={{ width: dim, height: dim, ...style }}
      {...props}
    />
  );
}

export { Spinner };
