import { notifications } from "@mantine/notifications";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type OauthRedirectOptions = {
  onResultOk?: () => Promise<void> | void;
  onResultLinked?: () => Promise<void> | void;
  providerFallback?: string;
};

type OauthErrorCode =
  | "cancelled"
  | "invalid_state"
  | "already_linked"
  | "exchange_failed"
  | "profile_failed"
  | "internal";

const formatProvider = (providerRaw?: string, fallback = "GitHub") => {
  if (!providerRaw) return fallback;
  const normalized = providerRaw.toString().trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "github") return "GitHub";
  if (normalized === "yandex") return "Яндекс";
  if (normalized === "vk") return "VK";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getErrorMessage = (
  code: OauthErrorCode,
  providerLabel: string,
): string => {
  switch (code) {
    case "cancelled":
      return `Вы отменили вход через ${providerLabel}`;
    case "invalid_state":
      return "Ссылка устарела, попробуйте ещё раз";
    case "already_linked":
      return `Этот ${providerLabel} уже привязан к другому аккаунту`;
    case "exchange_failed":
    case "profile_failed":
    case "internal":
    default:
      return `Не удалось войти через ${providerLabel}, попробуйте ещё раз`;
  }
};

export default function useOauthRedirect({
  onResultOk,
  onResultLinked,
  providerFallback = "GitHub",
}: OauthRedirectOptions) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const handledRef = useRef<string | null>(null);

  const legacyLinked = searchParams.get("github_linked") === "1";
  const oauthParam = searchParams.get("oauth") || (legacyLinked ? "github" : "");
  const resultParam =
    searchParams.get("result") || (legacyLinked ? "linked" : "");
  const errorParam = searchParams.get("error") || "";

  const hasOauthParams = useMemo(
    () => Boolean(oauthParam || resultParam || errorParam || legacyLinked),
    [oauthParam, resultParam, errorParam, legacyLinked],
  );

  const providerLabel = useMemo(
    () => formatProvider(oauthParam, providerFallback),
    [oauthParam, providerFallback],
  );

  useEffect(() => {
    if (!hasOauthParams) return;
    const key = searchParams.toString();
    if (handledRef.current === key) return;
    handledRef.current = key;

    const clearParams = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("oauth");
      next.delete("result");
      next.delete("error");
      next.delete("github_linked");
      navigate(
        { search: next.toString() ? `?${next.toString()}` : "" },
        { replace: true },
      );
    };

    const showError = (message: string) => {
      notifications.show({ message, color: "red" });
      clearParams();
    };

    if (errorParam) {
      const key = errorParam.toLowerCase() as OauthErrorCode;
      showError(getErrorMessage(key, providerLabel));
      return;
    }

    const handleOk = async () => {
      try {
        await onResultOk?.();
      } catch {
        // Ignore refresh errors; OAuth result already indicates success.
      }
      notifications.show({
        message: `Вход через ${providerLabel} выполнен`,
        color: "teal",
      });
      clearParams();
    };

    const handleLinked = async () => {
      try {
        await onResultLinked?.();
      } catch {
        // Ignore refresh errors; OAuth result already indicates success.
      }
      notifications.show({
        message: `${providerLabel} успешно подключён`,
        color: "teal",
      });
      clearParams();
    };

    if (resultParam === "ok") {
      void handleOk();
      return;
    }

    if (resultParam === "linked") {
      void handleLinked();
      return;
    }

    clearParams();
  }, [
    errorParam,
    hasOauthParams,
    navigate,
    onResultLinked,
    onResultOk,
    providerLabel,
    resultParam,
    searchParams,
  ]);

  return { hasOauthParams };
}