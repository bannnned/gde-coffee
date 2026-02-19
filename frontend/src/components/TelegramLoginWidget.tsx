import { Box, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef, useState } from "react";

import {
  telegramCallback,
  telegramConfig,
  telegramStart,
  type TelegramCallbackPayload,
  type TelegramFlow,
} from "../api/auth";

type TelegramWidgetUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
};

type TelegramLoginWidgetProps = {
  flow: TelegramFlow;
  size?: "large" | "medium" | "small";
};

const TELEGRAM_WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";

type TelegramWidgetError = {
  response?: {
    data?: {
      message?: string;
    };
  };
  normalized?: {
    message?: string;
  };
  message?: string;
};

function extractTelegramWidgetErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Не удалось выполнить вход через Telegram.";
  }
  const parsed = error as TelegramWidgetError;
  return (
    parsed.response?.data?.message ??
    parsed.normalized?.message ??
    parsed.message ??
    "Не удалось выполнить вход через Telegram."
  );
}

function normalizeTelegramUser(
  raw: TelegramWidgetUser,
): Omit<TelegramCallbackPayload, "state"> | null {
  const id = Number(raw?.id);
  const authDate = Number(raw?.auth_date);
  const hash = String(raw?.hash ?? "").trim();

  if (!Number.isFinite(id) || id <= 0) return null;
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (!hash) return null;

  const payload: Omit<TelegramCallbackPayload, "state"> = {
    id,
    auth_date: authDate,
    hash,
  };

  const username = String(raw?.username ?? "").trim();
  const firstName = String(raw?.first_name ?? "").trim();
  const lastName = String(raw?.last_name ?? "").trim();
  const photoUrl = String(raw?.photo_url ?? "").trim();

  if (username) payload.username = username;
  if (firstName) payload.first_name = firstName;
  if (lastName) payload.last_name = lastName;
  if (photoUrl) payload.photo_url = photoUrl;

  return payload;
}

export default function TelegramLoginWidget({
  flow,
  size = "large",
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackNameRef = useRef(
    `__tg_auth_${Math.random().toString(36).slice(2)}`,
  );
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isWidgetLoading, setIsWidgetLoading] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setIsConfigLoading(true);
      try {
        const config = await telegramConfig();
        if (cancelled) return;
        const username = String(config?.bot_username ?? "").trim();
        console.info("[telegram] config bot_username:", username || "(empty)");
        setBotUsername(username);
      } catch {
        if (cancelled) return;
        console.error("[telegram] failed to load /api/auth/telegram/config");
        setWidgetError("Не удалось получить настройки Telegram login.");
      } finally {
        if (!cancelled) {
          setIsConfigLoading(false);
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isConfigLoading) {
      return;
    }

    if (!botUsername) {
      console.warn("[telegram] bot_username is empty");
      setWidgetError("Telegram login не настроен: отсутствует TELEGRAM_BOT_USERNAME");
      container.innerHTML = "";
      return;
    }

    setWidgetError(null);
    setIsWidgetLoading(true);

    const callbackName = callbackNameRef.current;
    const onAuth = async (rawUser: TelegramWidgetUser) => {
      if (isSubmittingRef.current) return;

      const normalized = normalizeTelegramUser(rawUser);
      if (!normalized) {
        notifications.show({
          color: "red",
          message: "Telegram вернул некорректные данные входа.",
        });
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      try {
        const { state } = await telegramStart(flow);
        const redirectUrl = await telegramCallback({
          state,
          ...normalized,
        });
        window.location.assign(
          redirectUrl ||
            (flow === "link"
              ? "/settings?oauth=telegram&error=internal"
              : "/login?oauth=telegram&error=internal"),
        );
      } catch (error: unknown) {
        const message = extractTelegramWidgetErrorMessage(error);
        notifications.show({ color: "red", message });
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    };

    const callbacks = window as Window & Record<string, unknown>;
    callbacks[callbackName] = onAuth;

    const script = document.createElement("script");
    script.async = true;
    script.src = TELEGRAM_WIDGET_SRC;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", size);
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-lang", "ru");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    script.onerror = () => {
      setIsWidgetLoading(false);
      setWidgetError("Не удалось загрузить Telegram widget.");
    };

    container.innerHTML = "";
    container.appendChild(script);

    const markReadyIfWidgetMounted = () => {
      const hasWidget = Boolean(
        container.querySelector("iframe") ||
          container.querySelector("a") ||
          container.querySelector("[id^='telegram-login-']"),
      );
      if (hasWidget) {
        setIsWidgetLoading(false);
      }
    };

    // Widget may appear some time after script append.
    markReadyIfWidgetMounted();
    const observer = new MutationObserver(markReadyIfWidgetMounted);
    observer.observe(container, { childList: true, subtree: true });
    const readinessTimeout = window.setTimeout(() => {
      markReadyIfWidgetMounted();
      setIsWidgetLoading(false);
    }, 8000);

    return () => {
      observer.disconnect();
      window.clearTimeout(readinessTimeout);
      delete callbacks[callbackName];
      container.innerHTML = "";
    };
  }, [botUsername, flow, isConfigLoading, size]);

  return (
    <Box>
      <div
        ref={containerRef}
        style={{
          opacity: isSubmitting ? 0.6 : 1,
          pointerEvents: isSubmitting ? "none" : "auto",
          minHeight: 40,
        }}
      />
      {isSubmitting && (
        <Text size="xs" c="dimmed" mt={4}>
          Авторизуем через Telegram...
        </Text>
      )}
      {!widgetError && (isConfigLoading || isWidgetLoading) && (
        <Text size="xs" c="dimmed" mt={4}>
          Загружаем Telegram login...
        </Text>
      )}
      {widgetError && (
        <Text size="xs" c="red" mt={4}>
          {widgetError}
        </Text>
      )}
    </Box>
  );
}
