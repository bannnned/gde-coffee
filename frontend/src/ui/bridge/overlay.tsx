import type { ReactNode } from "react";
import { Drawer as MantineDrawer, Modal as MantineModal } from "@mantine/core";
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
}: AppModalProps) {
  // Dialog primitive is still Mantine-backed until STK-BL-010 migration
  // of feature overlays starts. Interface is stabilized here.
  if (implementation === "radix") {
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
