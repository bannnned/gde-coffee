import type { ReactNode } from "react";
import { Drawer as MantineDrawer, Modal as MantineModal } from "@mantine/core";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { IconX } from "@tabler/icons-react";

import {
  SheetClose,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui";
import { cn } from "../../lib/utils";

type BridgeEngine = "mantine" | "radix";

type AppModalProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
  centered?: boolean;
  fullScreen?: boolean;
  closeButton?: boolean;
  implementation?: BridgeEngine;
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
  centered = false,
  fullScreen = false,
  closeButton = true,
  implementation = "mantine",
  contentClassName,
  bodyClassName,
  titleClassName,
  presentation,
}: AppModalProps) {
  // Dialog primitive is still Mantine-backed until STK-BL-010 migration
  // of feature overlays starts. Interface is stabilized here.
  if (implementation === "radix") {
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
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
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
            <SheetHeader className="border-b border-border px-4 py-3">
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

  return (
    <MantineModal
      opened={open}
      onClose={() => onOpenChange(false)}
      title={title}
      centered={centered}
      fullScreen={fullScreen}
      withCloseButton={closeButton}
    >
      {children}
    </MantineModal>
  );
}

type AppSheetProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: ReactNode;
  children: ReactNode;
  side?: "left" | "right";
  implementation?: BridgeEngine;
  contentClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
};

export function AppSheet({
  open,
  onOpenChange,
  title,
  children,
  side = "right",
  implementation = "mantine",
  contentClassName,
  bodyClassName,
  titleClassName,
}: AppSheetProps) {
  if (implementation === "radix") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          className={cn(
            "h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] sm:max-w-none p-0",
            contentClassName,
          )}
        >
          {title ? (
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle className={titleClassName}>{title}</SheetTitle>
            </SheetHeader>
          ) : null}
          <div className={cn("h-full overflow-auto", bodyClassName)}>{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <MantineDrawer
      opened={open}
      onClose={() => onOpenChange(false)}
      position={side}
      size="100%"
      title={title}
    >
      {children}
    </MantineDrawer>
  );
}
