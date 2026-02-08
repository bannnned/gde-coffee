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

const errorMessages: Record<OauthErrorCode, string> = {
  cancelled: "Вы отменили вход через GitHub",
  invalid_state: "Ссылка устарела, попробуйте ещё раз",
  already_linked: "Этот GitHub уже привязан к другому аккаунту",
  exchange_failed: "Не удалось войти через GitHub",
  profile_failed: "Не удалось получить профиль GitHub",
  internal: "Ошибка входа, попробуйте позже",
};

const formatProvider = (providerRaw?: string, fallback = "GitHub") => {
  if (!providerRaw) return fallback;
  const normalized = providerRaw.toString().trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "github") return "GitHub";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
      showError(errorMessages[key] ?? "Ошибка входа, попробуйте позже");
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
