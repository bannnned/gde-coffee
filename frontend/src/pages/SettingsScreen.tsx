import {
  ActionIcon,
  Box,
  Button,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconCircleX,
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
import {
  getReviewsVersioningStatus,
  listReviewsDLQ,
  replayAllOpenReviewsDLQ,
  replayReviewsDLQEvent,
  resolveOpenReviewsDLQWithoutReplay,
  type ReviewsDLQEvent,
  type ReviewsDLQStatus,
  type ReviewsVersioningStatus,
} from "../api/reviews";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import useOauthRedirect from "../hooks/useOauthRedirect";
import classes from "./SettingsScreen.module.css";

type EmailChangeFormValues = {
  newEmail: string;
  currentPassword: string;
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
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [emailChangeResult, setEmailChangeResult] = useState<string | null>(null);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [reviewsVersioning, setReviewsVersioning] = useState<ReviewsVersioningStatus | null>(null);
  const [reviewsVersioningLoading, setReviewsVersioningLoading] = useState(false);
  const [reviewsVersioningError, setReviewsVersioningError] = useState<string | null>(null);
  const [dlqStatus, setDlqStatus] = useState<ReviewsDLQStatus>("open");
  const [dlqEvents, setDlqEvents] = useState<ReviewsDLQEvent[]>([]);
  const [dlqLoading, setDlqLoading] = useState(false);
  const [dlqError, setDlqError] = useState<string | null>(null);
  const [dlqReplayError, setDlqReplayError] = useState<string | null>(null);
  const [dlqBulkMessage, setDlqBulkMessage] = useState<string | null>(null);
  const [dlqBulkLoading, setDlqBulkLoading] = useState<"replay" | "resolve" | null>(null);
  const [dlqReplayingID, setDlqReplayingID] = useState<number | null>(null);
  const [versioningExpanded, setVersioningExpanded] = useState(false);
  const [dlqExpanded, setDlqExpanded] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [isFeedbackSending, setIsFeedbackSending] = useState(false);

  const verifiedParam = searchParams.get("verified") === "1";
  const emailChangedParam = searchParams.get("email_changed") === "1";

  const isVerified = Boolean(
    user?.emailVerifiedAt ||
      verifiedParam ||
      emailChangedParam,
  );

  const emailValue = user?.email ?? "—";

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    const target = event.currentTarget;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

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
    onResultLinked: refreshAuth,
  });

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

  return (
    <Box className={classes.screen} data-ui="settings-screen">
      <div className={classes.container}>
        <header className={classes.header}>
          <ActionIcon
            size={42}
            variant="transparent"
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
          </ActionIcon>
          <Text size="sm" className={classes.headerTitle}>
            {settingsTitle}
          </Text>
          <span className={classes.headerSpacer} aria-hidden="true" />
        </header>

        <Box className={classes.card}>
          <Stack gap="lg">
            {verifiedParam && (
              <div className={classes.banner}>Email успешно подтверждён.</div>
            )}
            {emailChangedParam && (
              <div className={classes.banner}>Email успешно изменён.</div>
            )}

            {canModerate && (
              <div className={classes.section}>
                <div className={classes.sectionHeader}>
                  <Group gap="xs">
                    <IconShieldCheck size={18} />
                    <Title order={4}>Модерация</Title>
                  </Group>
                </div>
                <Text size="sm" className={classes.muted} mb="sm">
                  Открыть очередь заявок на модерацию.
                </Text>
                <Group className={classes.actionsRow}>
                  <Button
                    variant="light"
                    className={classes.actionButton}
                    onClick={() => {
                      void navigate("/admin/moderation");
                    }}
                  >
                    Перейти в модерацию
                  </Button>
                  <Button
                    variant="light"
                    className={classes.actionButton}
                    onClick={() => {
                      void navigate("/admin/drinks");
                    }}
                  >
                    Справочник напитков
                  </Button>
                  <Button
                    variant="light"
                    className={classes.actionButton}
                    onClick={() => {
                      void navigate("/admin/metrics");
                    }}
                  >
                    North Star метрика
                  </Button>
                  {userRole === "admin" && (
                    <Button
                      variant="light"
                      className={classes.actionButton}
                      onClick={() => {
                        void navigate("/admin/cafes/import");
                      }}
                    >
                      Импорт кофеен JSON
                    </Button>
                  )}
                  {userRole === "admin" && (
                    <Button
                      variant="light"
                      className={classes.actionButton}
                      onClick={() => {
                        void navigate("/admin/feedback");
                      }}
                    >
                      Отзывы о приложении
                    </Button>
                  )}
                </Group>
                <div className={classes.versioningPanel}>
                  <button
                    type="button"
                    className={classes.panelToggle}
                    onClick={() => setVersioningExpanded((value) => !value)}
                    aria-expanded={versioningExpanded}
                  >
                    <Text fw={600} size="sm">
                      Версионирование отзывов
                    </Text>
                    {versioningExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </button>
                  {versioningExpanded && (
                    <>
                      {reviewsVersioningLoading && (
                        <Text size="sm" className={classes.muted} mt={6}>
                          Загружаем конфигурацию...
                        </Text>
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
                    <Text fw={600} size="sm">
                      DLQ пересчетов
                    </Text>
                    {dlqExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                  </button>
                  {dlqExpanded && (
                    <>
                      <div className={classes.dlqHeader}>
                        <span />
                        <Button
                          size="xs"
                          variant="light"
                          className={classes.actionButton}
                          onClick={() => {
                            void loadDLQ();
                          }}
                          loading={dlqLoading}
                        >
                          Обновить
                        </Button>
                      </div>
                      <Group className={classes.dlqStatusRow}>
                        {(["open", "resolved", "all"] as const).map((value) => (
                          <Button
                            key={`dlq-status-${value}`}
                            size="xs"
                            variant={dlqStatus === value ? "filled" : "light"}
                            className={classes.actionButton}
                            onClick={() => setDlqStatus(value)}
                          >
                            {value === "open" ? "Открытые" : value === "resolved" ? "Решенные" : "Все"}
                          </Button>
                        ))}
                      </Group>
                      <Group className={classes.dlqBulkActions}>
                        <Button
                          size="xs"
                          variant="filled"
                          className={classes.actionButton}
                          onClick={() => {
                            void handleReplayAllOpenDLQ();
                          }}
                          loading={dlqBulkLoading === "replay"}
                        >
                          Replay all open
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          className={classes.actionButton}
                          onClick={() => {
                            void handleResolveOpenDLQ();
                          }}
                          loading={dlqBulkLoading === "resolve"}
                        >
                          Resolve without replay
                        </Button>
                      </Group>

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
                        <Text size="sm" className={classes.muted} mt={8}>
                          Загружаем DLQ...
                        </Text>
                      )}
                      {!dlqLoading && !dlqError && dlqEvents.length === 0 && (
                        <Text size="sm" className={classes.muted} mt={8}>
                          Пусто: сообщений в выбранном фильтре нет.
                        </Text>
                      )}
                      {!dlqLoading && !dlqError && dlqEvents.length > 0 && (
                        <div className={classes.dlqList}>
                          {dlqEvents.map((item) => (
                            <div key={`dlq-event-${item.id}`} className={classes.dlqItem}>
                              <div className={classes.dlqItemHeader}>
                                <Text fw={600} size="sm">
                                  {item.event_type}
                                </Text>
                                <Text size="xs" className={classes.muted}>
                                  {item.consumer}
                                </Text>
                              </div>
                              <Text size="xs" className={classes.muted}>
                                outbox #{item.outbox_event_id} · inbox #{item.inbox_event_id || 0} · attempts {item.attempts}
                              </Text>
                              <Text size="xs" className={classes.muted}>
                                aggregate {item.aggregate_id}
                              </Text>
                              <Text size="xs" className={classes.dlqErrorText}>
                                {item.last_error || "Без текста ошибки"}
                              </Text>
                              <Group className={classes.dlqItemActions}>
                                <Text size="xs" className={classes.muted}>
                                  failed: {item.failed_at || "—"}
                                </Text>
                                <Text size="xs" className={classes.muted}>
                                  resolved: {item.resolved_at || "—"}
                                </Text>
                                <Button
                                  size="xs"
                                  variant="light"
                                  className={classes.actionButton}
                                  onClick={() => {
                                    void handleReplayDLQ(item.id);
                                  }}
                                  loading={dlqReplayingID === item.id}
                                >
                                  Replay
                                </Button>
                              </Group>
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
                <Group gap="xs">
                  {computedColorScheme === "dark" ? (
                    <IconMoon size={18} />
                  ) : (
                    <IconSun size={18} />
                  )}
                  <Title order={4}>Тема</Title>
                </Group>
              </div>
              <Text size="sm" className={classes.muted} mb="sm">
                Выберите оформление интерфейса.
              </Text>
              <Group className={classes.actionsRow}>
                <Button
                  variant={computedColorScheme === "light" ? "filled" : "light"}
                  className={classes.actionButton}
                  leftSection={<IconSun size={16} />}
                  onClick={() => setColorScheme("light")}
                >
                  Светлая
                </Button>
                <Button
                  variant={computedColorScheme === "dark" ? "filled" : "light"}
                  className={classes.actionButton}
                  leftSection={<IconMoon size={16} />}
                  onClick={() => setColorScheme("dark")}
                >
                  Тёмная
                </Button>
              </Group>
            </div>

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <Group gap="xs">
                  <IconMail size={18} />
                  <Title order={4}>Почта</Title>
                </Group>
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
              <Text fw={600}>{emailValue}</Text>
              <Text size="sm" className={classes.muted} mt={6}>
                Подтверждение почты нужно для защиты аккаунта и восстановления.
              </Text>
              <Group className={classes.actionsRow} mt="md">
                <Button
                  variant="filled"
                  className={classes.actionButton}
                  onClick={() => {
                    void handleVerifyRequest();
                  }}
                  leftSection={<IconShieldCheck size={16} />}
                  disabled={status !== "authed"}
                >
                  Отправить письмо подтверждения
                </Button>
              </Group>
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
                <Group gap="xs">
                  <IconMail size={18} />
                  <Title order={4}>Сменить email</Title>
                </Group>
              </div>
              <Box
                component="form"
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
                        <TextInput
                          label="Новый email"
                          placeholder="new@example.com"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          onFocus={handleFieldFocus}
                          ref={field.ref}
                          error={emailErrors.newEmail?.message}
                        />
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
                        <PasswordInput
                          label="Текущий пароль"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          onFocus={handleFieldFocus}
                          ref={field.ref}
                          error={emailErrors.currentPassword?.message}
                        />
                      )}
                  />
                </div>
                <Group className={classes.actionsRow} mt="md">
                  <Button
                    type="submit"
                    loading={isEmailSubmitting}
                    variant="filled"
                    className={classes.actionButton}
                  >
                    Отправить подтверждение
                  </Button>
                </Group>
              </Box>
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
            </div>

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <Group gap="xs">
                  <IconShieldCheck size={18} />
                  <Title order={4}>Сменить пароль</Title>
                </Group>
              </div>
              <Text size="sm" className={classes.muted} mb="sm">
                Мы отправим ссылку для смены пароля на вашу почту.
              </Text>
              <Box
                component="form"
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
                        <TextInput
                          label="Email"
                          placeholder="name@example.com"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          onFocus={handleFieldFocus}
                          ref={field.ref}
                          error={resetErrors.email?.message}
                        />
                      )}
                  />
                </div>
                <Group className={classes.actionsRow} mt="md">
                  <Button
                    type="submit"
                    loading={isResetSubmitting}
                    variant="filled"
                    className={classes.actionButton}
                  >
                    Отправить письмо
                  </Button>
                </Group>
              </Box>
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
            </div>

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <Group gap="xs">
                  <IconMessageCircle size={18} />
                  <Title order={4}>Отзыв о приложении</Title>
                </Group>
              </div>
              <Text size="sm" className={classes.muted}>
                Есть идея или баг? Напишите команде продукта.
              </Text>
              {!feedbackExpanded ? (
                <Group className={classes.actionsRow} mt="md">
                  <Button
                    variant="filled"
                    className={classes.actionButton}
                    onClick={() => setFeedbackExpanded(true)}
                    disabled={status !== "authed"}
                  >
                    Оставить отзыв
                  </Button>
                </Group>
              ) : (
                <Stack gap="sm" mt="md">
                  <Textarea
                    minRows={4}
                    autosize
                    maxRows={8}
                    placeholder="Например: на iPhone иногда дергается карта при открытии карточки кофейни..."
                    value={feedbackMessage}
                    onChange={(event) => {
                      setFeedbackMessage(event.currentTarget.value);
                      setFeedbackError(null);
                      setFeedbackSuccess(null);
                    }}
                    disabled={isFeedbackSending}
                  />
                  <TextInput
                    placeholder="Контакт для ответа (опционально): email, Telegram"
                    value={feedbackContact}
                    onChange={(event) => {
                      setFeedbackContact(event.currentTarget.value);
                      setFeedbackError(null);
                      setFeedbackSuccess(null);
                    }}
                    disabled={isFeedbackSending}
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
                  <Group className={classes.actionsRow}>
                    <Button
                      variant="filled"
                      className={classes.actionButton}
                      onClick={() => {
                        void handleFeedbackSubmit();
                      }}
                      loading={isFeedbackSending}
                      disabled={status !== "authed"}
                    >
                      Отправить отзыв
                    </Button>
                    <Button
                      variant="subtle"
                      className={classes.actionButton}
                      onClick={() => {
                        setFeedbackExpanded(false);
                        setFeedbackError(null);
                        setFeedbackSuccess(null);
                      }}
                      disabled={isFeedbackSending}
                    >
                      Скрыть форму
                    </Button>
                  </Group>
                </Stack>
              )}
            </div>

          </Stack>
        </Box>
      </div>
    </Box>
  );
}
