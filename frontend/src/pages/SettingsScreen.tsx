import {
  IconArrowLeft,
  IconBrandGithub,
  IconBrandTelegram,
  IconBrandYandex,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
  IconLinkOff,
  IconMail,
  IconMessageCircle,
  IconMoon,
  IconShieldCheck,
  IconSun,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, type FocusEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams, type Location as RouterLocation } from "react-router-dom";

import * as authApi from "../api/auth";
import { submitAppFeedback } from "../api/feedback";
import { buildOAuthLinkUrl } from "../api/url";
import {
  getReviewsAIHealth,
  getReviewsVersioningStatus,
  listReviewsDLQ,
  replayAllOpenReviewsDLQ,
  replayReviewsDLQEvent,
  resolveOpenReviewsDLQWithoutReplay,
  type ReviewsAIHealth,
  type ReviewsDLQEvent,
  type ReviewsDLQStatus,
  type ReviewsVersioningStatus,
} from "../api/reviews";
import { useAuth } from "../components/AuthGate";
import TelegramLoginWidget from "../components/TelegramLoginWidget";
import { Button as UIButton, Input } from "../components/ui";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import useAppColorScheme from "../hooks/useAppColorScheme";
import useOauthRedirect from "../hooks/useOauthRedirect";
import classes from "./SettingsScreen.module.css";

type EmailChangeFormValues = {
  newEmail: string;
  currentPassword: string;
};

type ProfileNameChangeFormValues = {
  displayName: string;
};

type PasswordResetRequestValues = {
  email: string;
};

type SettingsErrorLike = {
  normalized?: {
    message?: string;
  };
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
};

function extractSettingsErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const parsed = error as SettingsErrorLike;
  return parsed.response?.data?.message ?? parsed.normalized?.message ?? parsed.message ?? fallback;
}

export default function SettingsScreen() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, status, refreshAuth } = useAuth();
  const { setColorScheme, colorScheme } = useAppColorScheme();
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [nameChangeResult, setNameChangeResult] = useState<string | null>(null);
  const [nameChangeError, setNameChangeError] = useState<string | null>(null);
  const [emailChangeResult, setEmailChangeResult] = useState<string | null>(null);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [reviewsVersioning, setReviewsVersioning] = useState<ReviewsVersioningStatus | null>(null);
  const [reviewsVersioningLoading, setReviewsVersioningLoading] = useState(false);
  const [reviewsVersioningError, setReviewsVersioningError] = useState<string | null>(null);
  const [reviewsHealth, setReviewsHealth] = useState<ReviewsAIHealth | null>(null);
  const [reviewsHealthLoading, setReviewsHealthLoading] = useState(false);
  const [reviewsHealthError, setReviewsHealthError] = useState<string | null>(null);
  const [dlqStatus, setDlqStatus] = useState<ReviewsDLQStatus>("open");
  const [dlqEvents, setDlqEvents] = useState<ReviewsDLQEvent[]>([]);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqError, setDlqError] = useState<string | null>(null);
  const [dlqReplayError, setDlqReplayError] = useState<string | null>(null);
  const [dlqBulkMessage, setDlqBulkMessage] = useState<string | null>(null);
  const [dlqBulkLoading, setDlqBulkLoading] = useState<"replay" | "resolve" | null>(null);
  const [dlqReplayingID, setDlqReplayingID] = useState<number | null>(null);
  const [versioningExpanded, setVersioningExpanded] = useState(false);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [dlqExpanded, setDlqExpanded] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [isFeedbackSending, setIsFeedbackSending] = useState(false);
  const [identities, setIdentities] = useState<authApi.AuthIdentity[]>([]);
  const [isIdentitiesLoading, setIsIdentitiesLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const verifiedParam = searchParams.get("verified") === "1";
  const emailChangedParam = searchParams.get("email_changed") === "1";

  const isVerified = Boolean(
    user?.emailVerifiedAt ||
      verifiedParam ||
      emailChangedParam,
  );

  const emailValue = user?.email ?? "—";
  const accountEmail = user?.email?.trim() || "Email не указан";
  const accountId = user?.id || "—";

  const githubAuthUrl = useMemo(() => buildOAuthLinkUrl("github"), []);
  const yandexAuthUrl = useMemo(() => buildOAuthLinkUrl("yandex"), []);

  const isProviderLinked = useCallback(
    (providerName: string) =>
      identities.some((identity) => {
        const provider = identity.provider ?? identity.type ?? identity.name ?? "";
        return provider.toString().toLowerCase() === providerName;
      }),
    [identities],
  );

  const githubLinked = useMemo(() => isProviderLinked("github"), [isProviderLinked]);
  const yandexLinked = useMemo(() => isProviderLinked("yandex"), [isProviderLinked]);
  const telegramLinked = useMemo(() => isProviderLinked("telegram"), [isProviderLinked]);
  const allSocialLinked = githubLinked && yandexLinked && telegramLinked;

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    const target = event.currentTarget;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const refreshIdentities = useCallback(async () => {
    if (status !== "authed") {
      setIdentities([]);
      setIdentityError(null);
      setIsIdentitiesLoading(false);
      return;
    }

    setIsIdentitiesLoading(true);
    setIdentityError(null);
    try {
      const list = await authApi.getIdentities();
      setIdentities(list);
    } catch (error: unknown) {
      setIdentities([]);
      setIdentityError(
        extractSettingsErrorMessage(error, "Не удалось обновить список подключений."),
      );
    } finally {
      setIsIdentitiesLoading(false);
    }
  }, [status]);

  const handleFeedbackSubmit = useCallback(async () => {
    const message = feedbackMessage.trim();
    const contact = feedbackContact.trim();

    if (!message) {
      setFeedbackError("Напишите текст отзыва.");
      setFeedbackSuccess(null);
      return;
    }
    if (message.length > 4000) {
      setFeedbackError("Отзыв слишком длинный (максимум 4000 символов).");
      setFeedbackSuccess(null);
      return;
    }
    if (contact.length > 255) {
      setFeedbackError("Контакт слишком длинный (максимум 255 символов).");
      setFeedbackSuccess(null);
      return;
    }

    setIsFeedbackSending(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await submitAppFeedback({ message, contact });
      setFeedbackMessage("");
      setFeedbackContact("");
      setFeedbackSuccess("Спасибо, отзыв отправлен.");
    } catch (error: unknown) {
      setFeedbackError(extractSettingsErrorMessage(error, "Не удалось отправить отзыв."));
    } finally {
      setIsFeedbackSending(false);
    }
  }, [feedbackContact, feedbackMessage]);

  const {
    control: nameControl,
    handleSubmit: handleNameSubmit,
    formState: { errors: nameErrors, isSubmitting: isNameSubmitting },
    reset: resetNameForm,
  } = useForm<ProfileNameChangeFormValues>({
    defaultValues: {
      displayName: user?.displayName?.trim() || user?.name?.trim() || "",
    },
    mode: "onBlur",
  });

  const {
    control: emailControl,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors, isSubmitting: isEmailSubmitting },
    reset: resetEmailForm,
  } = useForm<EmailChangeFormValues>({
    defaultValues: { newEmail: "", currentPassword: "" },
    mode: "onBlur",
  });

  const {
    control: resetControl,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors, isSubmitting: isResetSubmitting },
    reset: resetResetForm,
  } = useForm<PasswordResetRequestValues>({
    defaultValues: { email: user?.email ?? "" },
    mode: "onBlur",
  });

  const statusLabel = isVerified ? "подтверждён" : "не подтверждён";
  const statusTone = isVerified ? "ok" : "warn";
  const userRole = (user?.role ?? "").toLowerCase();
  const canModerate = userRole === "admin" || userRole === "moderator";
  const backgroundLocation = (
    location.state as { backgroundLocation?: RouterLocation } | null
  )?.backgroundLocation;

  useOauthRedirect({
    onResultOk: refreshAuth,
    onResultLinked: async () => {
      await refreshAuth();
      await refreshIdentities();
    },
  });

  useEffect(() => {
    if (status !== "authed") {
      setIdentities([]);
      setIdentityError(null);
      setIsIdentitiesLoading(false);
      return;
    }
    void refreshIdentities();
  }, [refreshIdentities, status]);

  useEffect(() => {
    if (!canModerate || status !== "authed") {
      setReviewsVersioning(null);
      setReviewsVersioningError(null);
      setReviewsVersioningLoading(false);
      return;
    }

    let cancelled = false;
    setReviewsVersioningLoading(true);
    setReviewsVersioningError(null);
    getReviewsVersioningStatus()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setReviewsVersioning(result);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setReviewsVersioningError(
          extractSettingsErrorMessage(error, "Не удалось загрузить статус версий отзывов."),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setReviewsVersioningLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canModerate, status]);

  const loadReviewsHealth = useCallback(async () => {
    if (!canModerate || status !== "authed") {
      setReviewsHealth(null);
      setReviewsHealthError(null);
      setReviewsHealthLoading(false);
      return;
    }
    setReviewsHealthLoading(true);
    setReviewsHealthError(null);
    try {
      const response = await getReviewsAIHealth();
      setReviewsHealth(response);
    } catch (error: unknown) {
      setReviewsHealthError(
        extractSettingsErrorMessage(error, "Не удалось загрузить health-дашборд reviews/AI."),
      );
    } finally {
      setReviewsHealthLoading(false);
    }
  }, [canModerate, status]);

  useEffect(() => {
    void loadReviewsHealth();
  }, [loadReviewsHealth]);

  const loadDLQ = useCallback(async () => {
    if (!canModerate || status !== "authed") {
      setDlqEvents([]);
      setDlqError(null);
      setDlqLoading(false);
      return;
    }
    setDlqLoading(true);
    setDlqError(null);
    try {
      const response = await listReviewsDLQ({
        status: dlqStatus,
        limit: 20,
        offset: 0,
      });
      setDlqEvents(response.events);
    } catch (error: unknown) {
      setDlqError(extractSettingsErrorMessage(error, "Не удалось загрузить DLQ очереди."));
    } finally {
      setDlqLoading(false);
    }
  }, [canModerate, dlqStatus, status]);

  useEffect(() => {
    let cancelled = false;
    if (!canModerate || status !== "authed") {
      setDlqEvents([]);
      setDlqError(null);
      setDlqLoading(false);
      return;
    }

    setDlqLoading(true);
    setDlqError(null);
    listReviewsDLQ({
      status: dlqStatus,
      limit: 20,
      offset: 0,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setDlqEvents(response.events);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setDlqError(extractSettingsErrorMessage(error, "Не удалось загрузить DLQ очереди."));
      })
      .finally(() => {
        if (!cancelled) {
          setDlqLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canModerate, dlqStatus, status]);

  const handleReplayDLQ = useCallback(
    async (eventID: number) => {
      setDlqBulkMessage(null);
      setDlqReplayError(null);
      setDlqReplayingID(eventID);
      try {
        await replayReviewsDLQEvent(eventID);
        await loadDLQ();
      } catch (error: unknown) {
        setDlqReplayError(
          extractSettingsErrorMessage(error, "Не удалось запустить replay для сообщения."),
        );
      } finally {
        setDlqReplayingID(null);
      }
    },
    [loadDLQ],
  );

  const handleReplayAllOpenDLQ = useCallback(async () => {
    setDlqBulkMessage(null);
    setDlqReplayError(null);
    setDlqBulkLoading("replay");
    try {
      const result = await replayAllOpenReviewsDLQ();
      const failedSuffix =
        result.failed > 0
          ? `, ошибок: ${result.failed}${result.errors.length > 0 ? ` (${result.errors[0]})` : ""}`
          : "";
      setDlqBulkMessage(`Replay open завершен: ${result.replayed}/${result.processed}${failedSuffix}.`);
      await loadDLQ();
    } catch (error: unknown) {
      setDlqReplayError(
        extractSettingsErrorMessage(error, "Не удалось выполнить replay всех open сообщений."),
      );
    } finally {
      setDlqBulkLoading(null);
    }
  }, [loadDLQ]);

  const handleResolveOpenDLQ = useCallback(async () => {
    setDlqBulkMessage(null);
    setDlqReplayError(null);
    setDlqBulkLoading("resolve");
    try {
      const result = await resolveOpenReviewsDLQWithoutReplay();
      setDlqBulkMessage(`Resolve without replay завершен: закрыто ${result.resolved} сообщений.`);
      await loadDLQ();
    } catch (error: unknown) {
      setDlqReplayError(
        extractSettingsErrorMessage(error, "Не удалось закрыть open сообщения без replay."),
      );
    } finally {
      setDlqBulkLoading(null);
    }
  }, [loadDLQ]);

  const handleVerifyRequest = async () => {
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      await authApi.requestEmailVerification();
      setVerifySuccess("Письмо отправлено. Проверьте почту.");
    } catch (error: unknown) {
      setVerifyError(
        extractSettingsErrorMessage(error, "Не удалось отправить письмо. Попробуйте позже."),
      );
    }
  };

  const onNameChangeSubmit = handleNameSubmit(async (values) => {
    const displayName = values.displayName.trim();
    if (!displayName) {
      setNameChangeError("Введите имя профиля.");
      setNameChangeResult(null);
      return;
    }
    setNameChangeError(null);
    setNameChangeResult(null);
    try {
      await authApi.updateProfileName({ displayName });
      await refreshAuth();
      setNameChangeResult("Имя профиля обновлено.");
      resetNameForm({ displayName });
    } catch (error: unknown) {
      setNameChangeError(
        extractSettingsErrorMessage(error, "Не удалось обновить имя профиля."),
      );
    }
  });

  const onEmailChangeSubmit = handleEmailSubmit(async (values) => {
    setEmailChangeError(null);
    setEmailChangeResult(null);
    try {
      await authApi.requestEmailChange({
        newEmail: values.newEmail.trim(),
        currentPassword: values.currentPassword,
      });
      setEmailChangeResult(
        "Письмо для подтверждения отправлено на новый email.",
      );
      resetEmailForm();
    } catch (error: unknown) {
      setEmailChangeError(
        extractSettingsErrorMessage(error, "Не удалось отправить запрос. Проверьте данные."),
      );
    }
  });

  const onResetSubmit = handleResetSubmit(async (values) => {
    setResetError(null);
    setResetResult(null);
    try {
      await authApi.requestPasswordReset(values.email.trim());
      setResetResult("Если email существует, мы отправили письмо со ссылкой.");
      resetResetForm({ email: values.email });
    } catch (error: unknown) {
      setResetError(
        extractSettingsErrorMessage(error, "Не удалось отправить письмо. Попробуйте позже."),
      );
    }
  });

  const settingsTitle = useMemo(
    () => (status === "loading" ? "Загружаем аккаунт..." : "Аккаунт / Настройки"),
    [status],
  );

  useEffect(() => {
    resetNameForm({
      displayName: user?.displayName?.trim() || user?.name?.trim() || "",
    });
  }, [resetNameForm, user?.displayName, user?.name]);

  return (
    <main className={classes.screen} data-ui="settings-screen">
      <div className={classes.container}>
        <header className={classes.header}>
          <UIButton
            type="button"
            variant="ghost"
            size="icon"
            className={`${classes.iconButton} glass-action glass-action--square`}
            onClick={() => {
              if (backgroundLocation) {
                void navigate(-1);
                return;
              }
              void navigate("/profile");
            }}
            aria-label="Назад"
          >
            <IconArrowLeft size={18} />
          </UIButton>
          <p className={classes.headerTitle}>{settingsTitle}</p>
          <span className={classes.headerSpacer} aria-hidden="true" />
        </header>

        <div className={classes.card}>
          <div className={classes.stack}>
            {verifiedParam && (
              <div className={classes.banner}>Email успешно подтверждён.</div>
            )}
            {emailChangedParam && (
              <div className={classes.banner}>Email успешно изменён.</div>
            )}

            {canModerate && (
              <div className={classes.section}>
                <div className={classes.sectionHeader}>
                  <div className={classes.sectionTitleRow}>
                    <IconShieldCheck size={18} />
                    <h3 className={classes.sectionTitle}>Модерация</h3>
                  </div>
                </div>
                <p className={classes.sectionDescription}>Открыть очередь заявок на модерацию.</p>
                <div className={classes.actionsRow}>
                  <UIButton
                    type="button"
                    variant="secondary"
                    className={classes.actionButton}
                    onClick={() => {
                      void navigate("/admin/moderation");
                    }}
                  >
                    Перейти в модерацию
                  </UIButton>
                  <UIButton
                    type="button"
                    variant="secondary"
                    className={classes.actionButton}
                    onClick={() => {
                      void navigate("/admin/drinks");
                    }}
                  >
                    Справочник напитков
                  </UIButton>
                  <UIButton
                    type="button"
                    variant="secondary"
                    className={classes.actionButton}
                    onClick={() => {
                      void navigate("/admin/metrics");
                    }}
                  >
                    North Star метрика
                  </UIButton>
                  {userRole === "admin" && (
                    <UIButton
                      type="button"
                      variant="secondary"
                      className={classes.actionButton}
                      onClick={() => {
                        void navigate("/admin/cafes/manage");
                      }}
                    >
                      Кофейни (CRUD)
                    </UIButton>
                  )}
                  {userRole === "admin" && (
                    <UIButton
                      type="button"
                      variant="secondary"
                      className={classes.actionButton}
                      onClick={() => {
                        void navigate("/admin/cafes/import");
                      }}
                    >
                      Импорт кофеен JSON
                    </UIButton>
                  )}
                  {userRole === "admin" && (
                    <UIButton
                      type="button"
                      variant="secondary"
                      className={classes.actionButton}
                      onClick={() => {
                        void navigate("/admin/feedback");
                      }}
                    >
                      Отзывы о приложении
                    </UIButton>
                  )}
                </div>
                <div className={classes.versioningPanel}>
                  <button
                    type="button"
                    className={classes.panelToggle}
                    onClick={() => setVersioningExpanded((value) => !value)}
                    aria-expanded={versioningExpanded}
                  >
                    <span className={classes.panelToggleTitle}>Версионирование отзывов</span>
                    {versioningExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </button>
                  {versioningExpanded && (
                    <>
                      {reviewsVersioningLoading && (
                        <p className={classes.panelMutedText}>Загружаем конфигурацию...</p>
                      )}
                      {!reviewsVersioningLoading && reviewsVersioningError && (
                        <div className={classes.error} style={{ marginTop: 10 }}>
                          {reviewsVersioningError}
                        </div>
                      )}
                      {!reviewsVersioningLoading && reviewsVersioning && (
                        <div className={classes.versioningGrid}>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>API contract</span>
                            <span className={classes.versioningValue}>
                              {reviewsVersioning.api_contract_version}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Rating formula</span>
                            <span className={classes.versioningValue}>
                              {reviewsVersioning.formula_versions.rating}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Quality formula</span>
                            <span className={classes.versioningValue}>
                              {reviewsVersioning.formula_versions.quality}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Requested rating</span>
                            <span className={classes.versioningValue}>
                              {reviewsVersioning.formula_requests.rating}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Requested quality</span>
                            <span className={classes.versioningValue}>
                              {reviewsVersioning.formula_requests.quality}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Fallback rating</span>
                            <span
                              className={classes.versioningBoolean}
                              data-active={reviewsVersioning.formula_fallbacks.rating ? "true" : "false"}
                            >
                              {reviewsVersioning.formula_fallbacks.rating ? "yes" : "no"}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Fallback quality</span>
                            <span
                              className={classes.versioningBoolean}
                              data-active={reviewsVersioning.formula_fallbacks.quality ? "true" : "false"}
                            >
                              {reviewsVersioning.formula_fallbacks.quality ? "yes" : "no"}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>FF rating_v3</span>
                            <span
                              className={classes.versioningBoolean}
                              data-active={reviewsVersioning.feature_flags.rating_v3_enabled ? "true" : "false"}
                            >
                              {reviewsVersioning.feature_flags.rating_v3_enabled ? "on" : "off"}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>FF quality_v2</span>
                            <span
                              className={classes.versioningBoolean}
                              data-active={reviewsVersioning.feature_flags.quality_v2_enabled ? "true" : "false"}
                            >
                              {reviewsVersioning.feature_flags.quality_v2_enabled ? "on" : "off"}
                            </span>
                          </div>
                          {reviewsVersioning.ai_summary && (
                            <>
                              <div className={classes.versioningRow}>
                                <span className={classes.versioningKey}>AI prompt version</span>
                                <span className={classes.versioningValue}>
                                  {reviewsVersioning.ai_summary.prompt_version}
                                </span>
                              </div>
                              <div className={classes.versioningRow}>
                                <span className={classes.versioningKey}>AI model</span>
                                <span className={classes.versioningValue}>
                                  {reviewsVersioning.ai_summary.model}
                                </span>
                              </div>
                              <div className={classes.versioningRow}>
                                <span className={classes.versioningKey}>AI min reviews</span>
                                <span className={classes.versioningValue}>
                                  {reviewsVersioning.ai_summary.min_reviews}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className={classes.versioningPanel}>
                  <button
                    type="button"
                    className={classes.panelToggle}
                    onClick={() => setHealthExpanded((value) => !value)}
                    aria-expanded={healthExpanded}
                  >
                    <span className={classes.panelToggleTitle}>Health reviews/AI</span>
                    {healthExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </button>
                  {healthExpanded && (
                    <>
                      <div className={classes.dlqHeader} style={{ marginTop: 8 }}>
                        <p className={classes.panelMutedText}>
                          Мониторинг AI-суммаризации, очередей и покрытия снапшотов.
                        </p>
                        <UIButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={classes.actionButton}
                          onClick={() => {
                            void loadReviewsHealth();
                          }}
                          disabled={reviewsHealthLoading}
                        >
                          {reviewsHealthLoading ? (
                            <>
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Обновляем...
                            </>
                          ) : (
                            "Обновить"
                          )}
                        </UIButton>
                      </div>
                      {reviewsHealthError && !reviewsHealthLoading && (
                        <div className={classes.error} style={{ marginTop: 10 }}>
                          {reviewsHealthError}
                        </div>
                      )}
                      {reviewsHealthLoading && (
                        <p className={classes.panelMutedText}>Загружаем health-дашборд...</p>
                      )}
                      {!reviewsHealthLoading && !reviewsHealthError && reviewsHealth && (
                        <div className={classes.versioningGrid}>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Собрано в</span>
                            <span className={classes.versioningValue}>{reviewsHealth.generated_at || "—"}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Prompt version</span>
                            <span className={classes.versioningValue}>
                              {reviewsHealth.ai_summary.prompt_version || "—"}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Model</span>
                            <span className={classes.versioningValue}>{reviewsHealth.ai_summary.model || "—"}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>24h events</span>
                            <span className={classes.versioningValue}>{reviewsHealth.windows.last_24h.total_events}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>24h success rate</span>
                            <span className={classes.versioningValue}>
                              {(reviewsHealth.windows.last_24h.success_rate * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>24h tokens</span>
                            <span className={classes.versioningValue}>{reviewsHealth.windows.last_24h.total_tokens}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>7d tokens</span>
                            <span className={classes.versioningValue}>{reviewsHealth.windows.last_7d.total_tokens}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Budget guard</span>
                            <span
                              className={classes.versioningBoolean}
                              data-active={reviewsHealth.ai_summary.budget_guard_enabled ? "true" : "false"}
                            >
                              {reviewsHealth.ai_summary.budget_guard_enabled ? "on" : "off"}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Budget (today)</span>
                            <span className={classes.versioningValue}>
                              {reviewsHealth.ai_summary.daily_token_usage} / {reviewsHealth.ai_summary.daily_token_budget}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>DLQ open</span>
                            <span className={classes.versioningValue}>{reviewsHealth.queues.dlq_open}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Outbox pending</span>
                            <span className={classes.versioningValue}>{reviewsHealth.queues.outbox.pending}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Inbox pending</span>
                            <span className={classes.versioningValue}>{reviewsHealth.queues.inbox.pending}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Snapshots 24h</span>
                            <span className={classes.versioningValue}>
                              {reviewsHealth.coverage.snapshots_recent_24h}
                            </span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>AI OK 24h</span>
                            <span className={classes.versioningValue}>{reviewsHealth.coverage.ai_ok_recent_24h}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Last OK</span>
                            <span className={classes.versioningValue}>{reviewsHealth.last.ok_at || "—"}</span>
                          </div>
                          <div className={classes.versioningRow}>
                            <span className={classes.versioningKey}>Last error</span>
                            <span className={classes.versioningValue}>{reviewsHealth.last.error_at || "—"}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className={classes.dlqPanel}>
                  <button
                    type="button"
                    className={classes.panelToggle}
                    onClick={() => setDlqExpanded((value) => !value)}
                    aria-expanded={dlqExpanded}
                  >
                    <span className={classes.panelToggleTitle}>DLQ пересчетов</span>
                    {dlqExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </button>
                  {dlqExpanded && (
                    <>
                      <div className={classes.dlqHeader}>
                        <span />
                        <UIButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={classes.actionButton}
                          onClick={() => {
                            void loadDLQ();
                          }}
                          disabled={dlqLoading}
                        >
                          {dlqLoading ? (
                            <>
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Обновляем...
                            </>
                          ) : (
                            "Обновить"
                          )}
                        </UIButton>
                      </div>
                      <div className={classes.dlqStatusRow}>
                        {(["open", "resolved", "all"] as const).map((value) => (
                          <UIButton
                            type="button"
                            key={`dlq-status-${value}`}
                            size="sm"
                            variant={dlqStatus === value ? "default" : "secondary"}
                            className={classes.actionButton}
                            onClick={() => setDlqStatus(value)}
                          >
                            {value === "open" ? "Открытые" : value === "resolved" ? "Решенные" : "Все"}
                          </UIButton>
                        ))}
                      </div>
                      <div className={classes.dlqBulkActions}>
                        <UIButton
                          type="button"
                          size="sm"
                          variant="default"
                          className={classes.actionButton}
                          onClick={() => {
                            void handleReplayAllOpenDLQ();
                          }}
                          disabled={dlqBulkLoading === "replay"}
                        >
                          {dlqBulkLoading === "replay" ? (
                            <>
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Запускаем...
                            </>
                          ) : (
                            "Replay all open"
                          )}
                        </UIButton>
                        <UIButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={classes.actionButton}
                          onClick={() => {
                            void handleResolveOpenDLQ();
                          }}
                          disabled={dlqBulkLoading === "resolve"}
                        >
                          {dlqBulkLoading === "resolve" ? (
                            <>
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Закрываем...
                            </>
                          ) : (
                            "Resolve without replay"
                          )}
                        </UIButton>
                      </div>

                      {dlqReplayError && (
                        <div className={classes.error} style={{ marginTop: 10 }}>
                          {dlqReplayError}
                        </div>
                      )}
                      {dlqBulkMessage && (
                        <div className={classes.banner} style={{ marginTop: 10 }}>
                          {dlqBulkMessage}
                        </div>
                      )}
                      {dlqError && !dlqLoading && (
                        <div className={classes.error} style={{ marginTop: 10 }}>
                          {dlqError}
                        </div>
                      )}
                      {dlqLoading && (
                        <p className={classes.panelMutedText}>Загружаем DLQ...</p>
                      )}
                      {!dlqLoading && !dlqError && dlqEvents.length === 0 && (
                        <p className={classes.panelMutedText}>Пусто: сообщений в выбранном фильтре нет.</p>
                      )}
                      {!dlqLoading && !dlqError && dlqEvents.length > 0 && (
                        <div className={classes.dlqList}>
                          {dlqEvents.map((item) => (
                            <div key={`dlq-event-${item.id}`} className={classes.dlqItem}>
                              <div className={classes.dlqItemHeader}>
                                <p className={classes.dlqTitle}>{item.event_type}</p>
                                <p className={classes.dlqMeta}>{item.consumer}</p>
                              </div>
                              <p className={classes.dlqMeta}>
                                outbox #{item.outbox_event_id} · inbox #{item.inbox_event_id || 0} · attempts {item.attempts}
                              </p>
                              <p className={classes.dlqMeta}>
                                aggregate {item.aggregate_id}
                              </p>
                              <p className={classes.dlqErrorText}>
                                {item.last_error || "Без текста ошибки"}
                              </p>
                              <div className={classes.dlqItemActions}>
                                <p className={classes.dlqMeta}>
                                  failed: {item.failed_at || "—"}
                                </p>
                                <p className={classes.dlqMeta}>
                                  resolved: {item.resolved_at || "—"}
                                </p>
                                <UIButton
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className={classes.actionButton}
                                  onClick={() => {
                                    void handleReplayDLQ(item.id);
                                  }}
                                  disabled={dlqReplayingID === item.id}
                                >
                                  {dlqReplayingID === item.id ? (
                                    <>
                                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                      Replay...
                                    </>
                                  ) : (
                                    "Replay"
                                  )}
                                </UIButton>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <div className={classes.sectionTitleRow}>
                  {colorScheme === "dark" ? (
                    <IconMoon size={18} />
                  ) : (
                    <IconSun size={18} />
                  )}
                  <h3 className={classes.sectionTitle}>Тема</h3>
                </div>
              </div>
              <p className={classes.sectionDescription}>Выберите оформление интерфейса.</p>
              <div className={classes.actionsRow}>
                <UIButton
                  type="button"
                  variant={colorScheme === "light" ? "default" : "secondary"}
                  className={classes.actionButton}
                  onClick={() => setColorScheme("light")}
                >
                  <IconSun size={16} />
                  Светлая
                </UIButton>
                <UIButton
                  type="button"
                  variant={colorScheme === "dark" ? "default" : "secondary"}
                  className={classes.actionButton}
                  onClick={() => setColorScheme("dark")}
                >
                  <IconMoon size={16} />
                  Тёмная
                </UIButton>
              </div>
            </div>

            {user ? (
              <div className={classes.section}>
                <div className={classes.sectionHeader}>
                  <div className={classes.sectionTitleRow}>
                    <IconMail size={18} />
                    <h3 className={classes.sectionTitle}>Данные аккаунта</h3>
                  </div>
                </div>
                <p className={classes.sectionDescription}>
                  Базовые данные профиля и подключенные соцсети.
                </p>
                <div className={classes.accountDataGrid}>
                  <div className={classes.accountDataRow}>
                    <div className={classes.accountDataMeta}>
                      <p className={classes.accountDataLabel}>Email</p>
                      <p className={classes.accountDataValue}>{accountEmail}</p>
                    </div>
                    {isVerified ? (
                      <span className={classes.accountDataCheck} aria-label="Email подтверждён">
                        <IconCheck size={12} />
                      </span>
                    ) : null}
                  </div>
                  <div className={classes.accountDataRow}>
                    <div className={classes.accountDataMeta}>
                      <p className={classes.accountDataLabel}>ID аккаунта</p>
                      <p className={classes.accountDataValue}>{accountId}</p>
                    </div>
                  </div>
                </div>

                <div className={classes.socialHeader}>
                  <p className={classes.socialTitle}>Подключение соцсетей</p>
                  {isIdentitiesLoading ? (
                    <p className={classes.socialMuted}>Обновляем...</p>
                  ) : null}
                </div>

                <div className={classes.socialStatusRow}>
                  <div
                    className={classes.socialStatusItem}
                    data-linked={githubLinked ? "true" : "false"}
                    title={`GitHub: ${githubLinked ? "подключен" : "не подключен"}`}
                    aria-label={`GitHub: ${githubLinked ? "подключен" : "не подключен"}`}
                  >
                    <IconBrandGithub size={18} />
                    <span className={classes.socialStatusBadge}>
                      {githubLinked ? <IconCheck size={10} /> : <IconLinkOff size={10} />}
                    </span>
                  </div>
                  <div
                    className={classes.socialStatusItem}
                    data-linked={yandexLinked ? "true" : "false"}
                    title={`Яндекс: ${yandexLinked ? "подключен" : "не подключен"}`}
                    aria-label={`Яндекс: ${yandexLinked ? "подключен" : "не подключен"}`}
                  >
                    <IconBrandYandex size={18} />
                    <span className={classes.socialStatusBadge}>
                      {yandexLinked ? <IconCheck size={10} /> : <IconLinkOff size={10} />}
                    </span>
                  </div>
                  <div
                    className={classes.socialStatusItem}
                    data-linked={telegramLinked ? "true" : "false"}
                    title={`Telegram: ${telegramLinked ? "подключен" : "не подключен"}`}
                    aria-label={`Telegram: ${telegramLinked ? "подключен" : "не подключен"}`}
                  >
                    <IconBrandTelegram size={18} />
                    <span className={classes.socialStatusBadge}>
                      {telegramLinked ? <IconCheck size={10} /> : <IconLinkOff size={10} />}
                    </span>
                  </div>
                </div>

                <div className={`${classes.actionsRow} ${classes.socialActionsRow}`}>
                  {!githubLinked ? (
                    <UIButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      className={classes.actionButton}
                      onClick={() => window.location.assign(githubAuthUrl)}
                      disabled={isIdentitiesLoading}
                    >
                      Подключить GitHub
                    </UIButton>
                  ) : null}
                  {!yandexLinked ? (
                    <UIButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      className={classes.actionButton}
                      onClick={() => window.location.assign(yandexAuthUrl)}
                      disabled={isIdentitiesLoading}
                    >
                      Подключить Яндекс
                    </UIButton>
                  ) : null}
                  {!telegramLinked ? (
                    <TelegramLoginWidget flow="link" size="medium" />
                  ) : null}
                </div>

                {allSocialLinked ? (
                  <p className={classes.socialMuted}>Все соцсети подключены.</p>
                ) : null}
                {identityError ? (
                  <div className={classes.error} style={{ marginTop: 10 }}>
                    {identityError}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <div className={classes.sectionTitleRow}>
                  <IconMail size={18} />
                  <h3 className={classes.sectionTitle}>Почта</h3>
                </div>
              </div>
              <div className={classes.statusLine}>
                <span className={classes.statusPill} data-status={statusTone}>
                  {isVerified ? (
                    <IconCircleCheck size={14} />
                  ) : (
                    <IconCircleX size={14} />
                  )}
                  {statusLabel}
                </span>
              </div>
              <p className={classes.emailValue}>{emailValue}</p>
              <p className={classes.sectionDescription} style={{ marginTop: 6 }}>
                Подтверждение почты нужно для защиты аккаунта и восстановления.
              </p>
              <div className={classes.actionsRow} style={{ marginTop: 12 }}>
                <UIButton
                  type="button"
                  variant="default"
                  className="h-11 rounded-[14px] px-4"
                  onClick={() => {
                    void handleVerifyRequest();
                  }}
                  disabled={status !== "authed"}
                >
                  <IconShieldCheck size={16} />
                  Отправить письмо подтверждения
                </UIButton>
              </div>
              {verifySuccess && (
                <div className={classes.banner} style={{ marginTop: 12 }}>
                  {verifySuccess}
                </div>
              )}
              {verifyError && (
                <div className={classes.error} style={{ marginTop: 12 }}>
                  {verifyError}
                </div>
              )}
            </div>

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <div className={classes.sectionTitleRow}>
                  <IconShieldCheck size={18} />
                  <h3 className={classes.sectionTitle}>Смена данных</h3>
                </div>
              </div>

              <div className={classes.formGrid}>
                <form
                  onSubmit={(event) => {
                    void onNameChangeSubmit(event);
                  }}
                >
                  <div className={classes.formGrid}>
                    <Controller
                      name="displayName"
                      control={nameControl}
                      rules={{
                        required: "Введите имя",
                        minLength: { value: 2, message: "Минимум 2 символа" },
                      }}
                      render={({ field }) => (
                        <label className={classes.fieldBlock}>
                          <span className={classes.fieldLabel}>Имя профиля</span>
                          <Input
                            type="text"
                            placeholder="Ваше имя"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            onFocus={handleFieldFocus}
                            ref={field.ref}
                            className={classes.fieldInput}
                          />
                          {nameErrors.displayName?.message ? (
                            <span className={classes.fieldError}>
                              {String(nameErrors.displayName.message)}
                            </span>
                          ) : null}
                        </label>
                      )}
                    />
                  </div>
                  <div className={classes.actionsRow} style={{ marginTop: 12 }}>
                    <UIButton
                      type="submit"
                      disabled={isNameSubmitting}
                      className="h-11 rounded-[14px] px-4"
                    >
                      {isNameSubmitting ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Сохраняем...
                        </>
                      ) : (
                        "Сохранить имя"
                      )}
                    </UIButton>
                  </div>
                  {nameChangeResult && (
                    <div className={classes.banner} style={{ marginTop: 12 }}>
                      {nameChangeResult}
                    </div>
                  )}
                  {nameChangeError && (
                    <div className={classes.error} style={{ marginTop: 12 }}>
                      {nameChangeError}
                    </div>
                  )}
                </form>

                <form
                  onSubmit={(event) => {
                    void onEmailChangeSubmit(event);
                  }}
                >
                  <div className={classes.formGrid}>
                    <Controller
                      name="newEmail"
                      control={emailControl}
                      rules={{
                        required: "Введите новый email",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Введите корректный email",
                        },
                      }}
                      render={({ field }) => (
                        <label className={classes.fieldBlock}>
                          <span className={classes.fieldLabel}>Новый email</span>
                          <Input
                            type="email"
                            placeholder="new@example.com"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            onFocus={handleFieldFocus}
                            ref={field.ref}
                            className={classes.fieldInput}
                          />
                          {emailErrors.newEmail?.message ? (
                            <span className={classes.fieldError}>
                              {String(emailErrors.newEmail.message)}
                            </span>
                          ) : null}
                        </label>
                      )}
                    />
                    <Controller
                      name="currentPassword"
                      control={emailControl}
                      rules={{
                        required: "Введите текущий пароль",
                        minLength: { value: 8, message: "Минимум 8 символов" },
                      }}
                      render={({ field }) => (
                        <label className={classes.fieldBlock}>
                          <span className={classes.fieldLabel}>Текущий пароль</span>
                          <Input
                            type="password"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            onFocus={handleFieldFocus}
                            ref={field.ref}
                            className={classes.fieldInput}
                          />
                          {emailErrors.currentPassword?.message ? (
                            <span className={classes.fieldError}>
                              {String(emailErrors.currentPassword.message)}
                            </span>
                          ) : null}
                        </label>
                      )}
                    />
                  </div>
                  <div className={classes.actionsRow} style={{ marginTop: 12 }}>
                    <UIButton
                      type="submit"
                      disabled={isEmailSubmitting}
                      className="h-11 rounded-[14px] px-4"
                    >
                      {isEmailSubmitting ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Отправляем...
                        </>
                      ) : (
                        "Сменить email"
                      )}
                    </UIButton>
                  </div>
                  {emailChangeResult && (
                    <div className={classes.banner} style={{ marginTop: 12 }}>
                      {emailChangeResult}
                    </div>
                  )}
                  {emailChangeError && (
                    <div className={classes.error} style={{ marginTop: 12 }}>
                      {emailChangeError}
                    </div>
                  )}
                </form>

                <form
                  onSubmit={(event) => {
                    void onResetSubmit(event);
                  }}
                >
                  <div className={classes.formGrid}>
                    <Controller
                      name="email"
                      control={resetControl}
                      rules={{
                        required: "Введите email",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Введите корректный email",
                        },
                      }}
                      render={({ field }) => (
                        <label className={classes.fieldBlock}>
                          <span className={classes.fieldLabel}>Email для сброса пароля</span>
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            onFocus={handleFieldFocus}
                            ref={field.ref}
                            className={classes.fieldInput}
                          />
                          {resetErrors.email?.message ? (
                            <span className={classes.fieldError}>
                              {String(resetErrors.email.message)}
                            </span>
                          ) : null}
                        </label>
                      )}
                    />
                  </div>
                  <div className={classes.actionsRow} style={{ marginTop: 12 }}>
                    <UIButton
                      type="submit"
                      disabled={isResetSubmitting}
                      className="h-11 rounded-[14px] px-4"
                    >
                      {isResetSubmitting ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Отправляем...
                        </>
                      ) : (
                        "Сбросить пароль"
                      )}
                    </UIButton>
                  </div>
                  {resetResult && (
                    <div className={classes.banner} style={{ marginTop: 12 }}>
                      {resetResult}
                    </div>
                  )}
                  {resetError && (
                    <div className={classes.error} style={{ marginTop: 12 }}>
                      {resetError}
                    </div>
                  )}
                </form>
              </div>
            </div>

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <div className={classes.sectionTitleRow}>
                  <IconMessageCircle size={18} />
                  <h3 className={classes.sectionTitle}>Отзыв о приложении</h3>
                </div>
              </div>
              <p className={classes.sectionDescription}>
                Есть идея или баг? Напишите команде продукта.
              </p>
              {!feedbackExpanded ? (
                <div className={classes.actionsRow} style={{ marginTop: 12 }}>
                  <UIButton
                    type="button"
                    className="h-11 rounded-[14px] px-4"
                    onClick={() => setFeedbackExpanded(true)}
                    disabled={status !== "authed"}
                  >
                    Оставить отзыв
                  </UIButton>
                </div>
              ) : (
                <div className={classes.feedbackForm}>
                  <textarea
                    rows={4}
                    className={classes.fieldTextarea}
                    placeholder="Например: на iPhone иногда дергается карта при открытии карточки кофейни..."
                    value={feedbackMessage}
                    onChange={(event) => {
                      setFeedbackMessage(event.currentTarget.value);
                      setFeedbackError(null);
                      setFeedbackSuccess(null);
                    }}
                    disabled={isFeedbackSending}
                  />
                  <Input
                    placeholder="Контакт для ответа (опционально): email, Telegram"
                    value={feedbackContact}
                    onChange={(event) => {
                      setFeedbackContact(event.currentTarget.value);
                      setFeedbackError(null);
                      setFeedbackSuccess(null);
                    }}
                    disabled={isFeedbackSending}
                    className={classes.fieldInput}
                  />
                  {feedbackError && (
                    <div className={classes.error}>
                      {feedbackError}
                    </div>
                  )}
                  {feedbackSuccess && (
                    <div className={classes.banner}>
                      {feedbackSuccess}
                    </div>
                  )}
                  <div className={classes.actionsRow}>
                    <UIButton
                      type="button"
                      className="h-11 rounded-[14px] px-4"
                      onClick={() => {
                        void handleFeedbackSubmit();
                      }}
                      disabled={status !== "authed"}
                    >
                      {isFeedbackSending ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Отправляем...
                        </>
                      ) : (
                        "Отправить отзыв"
                      )}
                    </UIButton>
                    <UIButton
                      type="button"
                      variant="secondary"
                      className="h-11 rounded-[14px] px-4"
                      onClick={() => {
                        setFeedbackExpanded(false);
                        setFeedbackError(null);
                        setFeedbackSuccess(null);
                      }}
                      disabled={isFeedbackSending}
                    >
                      Скрыть форму
                    </UIButton>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
