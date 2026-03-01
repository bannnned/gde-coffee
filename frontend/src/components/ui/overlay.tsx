import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";

import {
  SheetClose,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./sheet";
import { cn } from "../../lib/utils";

type AppModalProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
  fullScreen?: boolean;
  closeButton?: boolean;
  contentClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
  presentation?: "sheet" | "dialog";
};

export function AppModal({
  open,
  onOpenChange,
  title,
  children,
  fullScreen = false,
  closeButton = true,
  contentClassName,
  bodyClassName,
  titleClassName,
  presentation,
}: AppModalProps) {
  const asSheet = (presentation ?? (fullScreen ? "sheet" : "dialog")) === "sheet";
  if (!asSheet) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[3000] bg-[color:var(--color-surface-overlay-strong)] backdrop-blur-[8px]" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-[3001] w-[min(96vw,1080px)] -translate-x-1/2 -translate-y-1/2 outline-none",
              contentClassName,
            )}
          >
            {(title || closeButton) && (
              <div className="flex items-center justify-between gap-2 px-4 pb-0 pt-3">
                {title ? (
                  <DialogPrimitive.Title className={cn("min-w-0 flex-1", titleClassName)}>
                    {title}
                  </DialogPrimitive.Title>
                ) : (
                  <span />
                )}
                {closeButton ? (
                  <DialogPrimitive.Close
                    aria-label="Закрыть"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text transition ui-interactive ui-focus-ring"
                  >
                    <IconX size={16} />
                  </DialogPrimitive.Close>
                ) : null}
              </div>
            )}
            <div className={cn(bodyClassName)}>{children}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "w-full rounded-none border-0 p-0",
          fullScreen
            ? "h-[100dvh] max-h-[100dvh]"
            : "h-auto max-h-[86dvh]",
          contentClassName,
        )}
      >
        {(title || closeButton) && (
          <SheetHeader className="px-4 pb-0 pt-3">
            <div className="flex items-center justify-between gap-2">
              {title ? (
                <SheetTitle className={cn("min-w-0 flex-1", titleClassName)}>{title}</SheetTitle>
              ) : (
                <span />
              )}
              {closeButton ? (
                <SheetClose
                  aria-label="Закрыть"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text transition ui-interactive ui-focus-ring"
                >
                  <IconX size={16} />
                </SheetClose>
              ) : null}
            </div>
            <SheetDescription className="sr-only">Dialog content</SheetDescription>
          </SheetHeader>
        )}
        <div
          className={cn(
            fullScreen
              ? "h-[calc(100dvh-58px)] overflow-auto"
              : "max-h-[calc(86dvh-58px)] overflow-auto",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

type AppSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: ReactNode;
  closeButton?: boolean;
  children: ReactNode;
  side?: "left" | "right";
  contentClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
};

export function AppSheet({
  open,
  onOpenChange,
  title,
  closeButton = true,
  children,
  side = "right",
  contentClassName,
  bodyClassName,
  titleClassName,
}: AppSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] sm:max-w-none p-0",
          contentClassName,
        )}
      >
        {title || closeButton ? (
          <SheetHeader className="px-4 pb-0 pt-3">
            <div className="flex items-center justify-between gap-2">
              {title ? (
                <SheetTitle className={cn("min-w-0 flex-1", titleClassName)}>{title}</SheetTitle>
              ) : (
                <span />
              )}
              {closeButton ? (
                <SheetClose
                  aria-label="Закрыть"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text transition ui-interactive ui-focus-ring"
                >
                  <IconX size={16} />
                </SheetClose>
              ) : null}
            </div>
          </SheetHeader>
        ) : null}
        <div className={cn("h-full overflow-auto", bodyClassName)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
