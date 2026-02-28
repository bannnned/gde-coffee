import { IconCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { cn } from "./utils";

type NotificationColor = string | undefined;

type NotificationInput = {
  id?: string;
  title?: ReactNode;
  message?: ReactNode;
  color?: NotificationColor;
  autoClose?: number;
};

type NotificationState = {
  id: string;
  title?: ReactNode;
  message?: ReactNode;
  color?: NotificationColor;
  autoClose: number;
};

type NotificationsListener = (next: NotificationState[]) => void;

const DEFAULT_AUTO_CLOSE_MS = 4000;
let notificationsState: NotificationState[] = [];
const listeners = new Set<NotificationsListener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(notificationsState);
  }
}

function subscribe(listener: NotificationsListener) {
  listeners.add(listener);
  listener(notificationsState);
  return () => {
    listeners.delete(listener);
  };
}

function makeID() {
  return `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeAutoClose(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return DEFAULT_AUTO_CLOSE_MS;
  }
  return Number(value);
}

function upsertNotification(item: NotificationState) {
  const idx = notificationsState.findIndex((entry) => entry.id === item.id);
  if (idx >= 0) {
    notificationsState = [
      ...notificationsState.slice(0, idx),
      item,
      ...notificationsState.slice(idx + 1),
    ];
  } else {
    notificationsState = [...notificationsState, item];
  }
  notifyListeners();
}

function removeNotification(id: string) {
  const next = notificationsState.filter((item) => item.id !== id);
  if (next.length === notificationsState.length) return;
  notificationsState = next;
  notifyListeners();
}

export const notifications = {
  show(input: NotificationInput) {
    const id = input.id?.trim() || makeID();
    upsertNotification({
      id,
      title: input.title,
      message: input.message,
      color: input.color,
      autoClose: normalizeAutoClose(input.autoClose),
    });
    return id;
  },
  hide(id: string) {
    removeNotification(id);
  },
  update(input: NotificationInput & { id: string }) {
    const current = notificationsState.find((item) => item.id === input.id);
    if (!current) {
      this.show(input);
      return;
    }
    upsertNotification({
      ...current,
      ...input,
      autoClose: normalizeAutoClose(input.autoClose ?? current.autoClose),
    });
  },
  clean() {
    if (notificationsState.length === 0) return;
    notificationsState = [];
    notifyListeners();
  },
};

function getTone(color: NotificationColor): "error" | "success" | "warning" | "info" {
  const value = (color ?? "").toLowerCase();
  if (value.includes("red")) return "error";
  if (value.includes("green")) return "success";
  if (value.includes("yellow") || value.includes("orange")) return "warning";
  return "info";
}

function toneStyles(tone: "error" | "success" | "warning" | "info") {
  if (tone === "error") {
    return {
      borderColor: "var(--color-status-error)",
      background: "color-mix(in srgb, var(--color-status-error) 8%, var(--surface))",
      icon: <IconInfoCircle size={16} />,
    };
  }
  if (tone === "success") {
    return {
      borderColor: "var(--color-status-success)",
      background: "color-mix(in srgb, var(--color-status-success) 10%, var(--surface))",
      icon: <IconCheck size={16} />,
    };
  }
  if (tone === "warning") {
    return {
      borderColor: "var(--color-status-warning)",
      background: "color-mix(in srgb, var(--color-status-warning) 10%, var(--surface))",
      icon: <IconInfoCircle size={16} />,
    };
  }
  return {
    borderColor: "var(--color-status-info)",
    background: "color-mix(in srgb, var(--color-status-info) 10%, var(--surface))",
    icon: <IconInfoCircle size={16} />,
  };
}

export function AppNotifications() {
  const [items, setItems] = useState<NotificationState[]>([]);

  useEffect(() => subscribe(setItems), []);

  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((item) =>
      window.setTimeout(() => {
        notifications.hide(item.id);
      }, item.autoClose),
    );
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [items]);

  const ordered = useMemo(() => [...items].reverse(), [items]);

  if (ordered.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[5000] flex w-[min(420px,calc(100vw-24px))] flex-col gap-2"
    >
      {ordered.map((item) => {
        const tone = getTone(item.color);
        const styles = toneStyles(tone);
        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto rounded-[14px] border px-3 py-2 shadow-[0_14px_30px_var(--color-surface-overlay-soft)] backdrop-blur-[6px]",
            )}
            style={{
              borderColor: styles.borderColor,
              background: styles.background,
            }}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                style={{ color: styles.borderColor }}
              >
                {styles.icon}
              </span>
              <div className="min-w-0 flex-1">
                {item.title ? <p className="m-0 text-sm font-semibold text-text">{item.title}</p> : null}
                {item.message ? <div className="text-sm text-text">{item.message}</div> : null}
              </div>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] text-muted transition hover:bg-black/5 hover:text-text ui-focus-ring"
                onClick={() => notifications.hide(item.id)}
                aria-label="Закрыть уведомление"
              >
                <IconX size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

