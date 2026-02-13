import { Box, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef, useState } from "react";

import {
  telegramCallback,
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
const TELEGRAM_BOT_USERNAME = (
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? ""
).trim();

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
  const [widgetError, setWidgetError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!TELEGRAM_BOT_USERNAME) {
      setWidgetError("Telegram login не настроен: отсутствует VITE_TELEGRAM_BOT_USERNAME");
      return;
    }

    setWidgetError(null);

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
      } catch (err: any) {
        const message =
          err?.response?.data?.message ??
          err?.normalized?.message ??
          err?.message ??
          "Не удалось выполнить вход через Telegram.";
        notifications.show({ color: "red", message });
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    };

    (window as any)[callbackName] = onAuth;

    const script = document.createElement("script");
    script.async = true;
    script.src = TELEGRAM_WIDGET_SRC;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", size);
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-lang", "ru");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-onauth", `${callbackName}(user)`);
    script.onerror = () => {
      setWidgetError("Не удалось загрузить Telegram widget.");
    };

    container.innerHTML = "";
    container.appendChild(script);

    return () => {
      delete (window as any)[callbackName];
      container.innerHTML = "";
    };
  }, [flow, size]);

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
      {widgetError && (
        <Text size="xs" c="red" mt={4}>
          {widgetError}
        </Text>
      )}
    </Box>
  );
}
