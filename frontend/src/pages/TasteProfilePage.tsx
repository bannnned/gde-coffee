import {
  IconArrowLeft,
  IconBulb,
  IconCheck,
  IconRefresh,
  IconRotate,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { createJourneyID, reportMetricEvent } from "../api/metrics";
import {
  acceptTasteHypothesis,
  dismissTasteHypothesis,
  getMyTasteMap,
  type TasteMapHypothesis,
  type TasteMapResponse,
  type TasteMapTag,
} from "../api/taste";
import { useAuth } from "../components/AuthGate";
import { Button } from "../components/ui";
import { isTasteMapV1Enabled } from "../features/taste/model/flags";
import {
  getPolarityLabel,
  getSourceLabel,
  getTasteLabel,
} from "../features/taste/model/tasteLabels";
import { appHaptics } from "../lib/haptics";
import { extractApiErrorMessage, extractApiErrorStatus } from "../utils/apiError";
import classes from "./TasteProfilePage.module.css";

type LoadState = "idle" | "loading" | "ready" | "error" | "feature-off";

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(Math.abs(value) * 100)));
}

export default function TasteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, openAuthModal } = useAuth();

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [payload, setPayload] = useState<TasteMapResponse | null>(null);
  const [busyHypothesisID, setBusyHypothesisID] = useState<string | null>(null);
  const journeyIDRef = useRef<string>(createJourneyID("taste_profile"));
  const shownHypothesisIDsRef = useRef<Set<string>>(new Set());

  const tasteMapEnabled = isTasteMapV1Enabled();
  const userID = (user?.id ?? "").trim();
  const backgroundLocation = (
    location.state as { backgroundLocation?: RouterLocation } | null
  )?.backgroundLocation;

  const loadTasteMap = useCallback(async () => {
    if (!tasteMapEnabled) {
      setLoadState("feature-off");
      return;
    }
    if (status !== "authed" || !userID) return;

    setLoadState("loading");
    setError(null);
    try {
      const next = await getMyTasteMap();
      setPayload(next);
      setLoadState("ready");
    } catch (err: unknown) {
      const statusCode = extractApiErrorStatus(err);
      if (statusCode === 404) {
        setLoadState("feature-off");
      } else {
        setError(extractApiErrorMessage(err, "Не удалось загрузить профиль вкуса."));
        setLoadState("error");
        reportMetricEvent({
          event_type: "taste_api_error",
          journey_id: journeyIDRef.current,
          meta: {
            stage: "load_profile",
            status_code: statusCode ?? 0,
            source: "taste_profile_page",
          },
        });
      }
    }
  }, [status, tasteMapEnabled, userID]);

  useEffect(() => {
    if (!tasteMapEnabled) {
      setLoadState("feature-off");
      return;
    }
    if (status === "loading") {
      setLoadState("loading");
      return;
    }
    if (status === "authed" && userID) {
      void loadTasteMap();
      return;
    }
    setLoadState("idle");
  }, [loadTasteMap, status, tasteMapEnabled, userID]);

  const activeTags = useMemo(() => {
    const list = payload?.active_tags ?? [];
    return [...list].sort((a, b) => {
      const left = Math.abs(a.score) * a.confidence;
      const right = Math.abs(b.score) * b.confidence;
      return right - left;
    });
  }, [payload?.active_tags]);

  const hypotheses = payload?.hypotheses ?? [];

  useEffect(() => {
    if (hypotheses.length === 0) {
      return;
    }
    for (const item of hypotheses.slice(0, 8)) {
      const hypothesisID = (item.id ?? "").trim();
      if (!hypothesisID) continue;
      if (shownHypothesisIDsRef.current.has(hypothesisID)) continue;
      shownHypothesisIDsRef.current.add(hypothesisID);
      reportMetricEvent({
        event_type: "taste_hypothesis_shown",
        journey_id: journeyIDRef.current,
        meta: {
          hypothesis_id: hypothesisID,
          taste_code: item.taste_code,
          polarity: item.polarity,
          source: "taste_profile_page",
        },
      });
    }
  }, [hypotheses]);

  const insights = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Inference version: ${payload?.inference_version ?? "-"}`);
    lines.push(`Последнее обновление: ${formatDate(payload?.updated_at)}`);

    if (payload?.base_map?.completed_at) {
      lines.push(`Карта вкуса пройдена: ${formatDate(payload.base_map.completed_at)}`);
    } else {
      lines.push("Базовая карта вкуса еще не завершена.");
    }

    if (payload?.base_map?.onboarding_version) {
      lines.push(`Версия onboarding: ${payload.base_map.onboarding_version}`);
    }

    const reasons = (payload?.hypotheses ?? [])
      .map((item) => item.reason?.trim())
      .filter((item): item is string => Boolean(item));

    if (reasons.length > 0) {
      for (const reason of reasons.slice(0, 3)) {
        lines.push(reason);
      }
    } else {
      lines.push("Учитываем отзывы, проверенные визиты и подтвержденные вами гипотезы.");
    }

    return lines;
  }, [payload]);

  const goBack = useCallback(() => {
    if (backgroundLocation) {
      void navigate(-1);
      return;
    }
    void navigate("/profile");
  }, [backgroundLocation, navigate]);

  const applyFeedback = useCallback(
    async (
      hypothesis: TasteMapHypothesis,
      action: "accept" | "dismiss",
    ) => {
      if (!hypothesis.id) return;
      setActionError(null);
      setActionSuccess(null);
      setBusyHypothesisID(hypothesis.id);
      void appHaptics.trigger("selection");

      try {
        if (action === "accept") {
          await acceptTasteHypothesis(hypothesis.id, { feedback_source: "profile_screen" });
          void appHaptics.trigger("success");
          setActionSuccess(`Гипотеза «${getTasteLabel(hypothesis.taste_code)}» подтверждена.`);
          reportMetricEvent({
            event_type: "taste_hypothesis_confirmed",
            journey_id: journeyIDRef.current,
            meta: {
              hypothesis_id: hypothesis.id,
              taste_code: hypothesis.taste_code,
              polarity: hypothesis.polarity,
              source: "taste_profile_page",
            },
          });
        } else {
          await dismissTasteHypothesis(hypothesis.id, {
            feedback_source: "profile_screen",
            reason_code: "not_me",
          });
          void appHaptics.trigger("warning");
          setActionSuccess(`Гипотеза «${getTasteLabel(hypothesis.taste_code)}» скрыта на cooldown.`);
          reportMetricEvent({
            event_type: "taste_hypothesis_dismissed",
            journey_id: journeyIDRef.current,
            meta: {
              hypothesis_id: hypothesis.id,
              taste_code: hypothesis.taste_code,
              polarity: hypothesis.polarity,
              reason_code: "not_me",
              source: "taste_profile_page",
            },
          });
        }
        await loadTasteMap();
      } catch (err: unknown) {
        void appHaptics.trigger("error");
        setActionError(
          extractApiErrorMessage(err, "Не удалось сохранить обратную связь по гипотезе."),
        );
        reportMetricEvent({
          event_type: "taste_api_error",
          journey_id: journeyIDRef.current,
          meta: {
            stage: action === "accept" ? "accept_hypothesis" : "dismiss_hypothesis",
            status_code: extractApiErrorStatus(err) ?? 0,
            source: "taste_profile_page",
          },
        });
      } finally {
        setBusyHypothesisID(null);
      }
    },
    [loadTasteMap],
  );

  return (
    <div className={classes.screen} data-ui="taste-profile-screen">
      <div className={classes.container}>
        <header className={classes.header}>
          <Button type="button" size="icon" variant="secondary" onClick={goBack} aria-label="Назад">
            <IconArrowLeft size={18} />
          </Button>
          <h1 className={classes.headerTitle}>Профиль вкуса</h1>
          <div className={classes.headerSpacer} />
        </header>

        {!tasteMapEnabled || loadState === "feature-off" ? (
          <section className={classes.card}>
            <p className={classes.title}>Taste Map выключен</p>
            <p className={classes.subtitle}>
              Включите `VITE_TASTE_MAP_V1_ENABLED=1`, чтобы использовать профиль вкуса.
            </p>
            <Button type="button" onClick={() => void navigate("/profile")}>Вернуться в профиль</Button>
          </section>
        ) : null}

        {tasteMapEnabled && status === "loading" ? (
          <section className={classes.card}>
            <p className={classes.subtitle}>Проверяем авторизацию...</p>
          </section>
        ) : null}

        {tasteMapEnabled && status !== "loading" && status !== "authed" ? (
          <section className={classes.card}>
            <p className={classes.title}>Нужна авторизация</p>
            <p className={classes.subtitle}>Профиль вкуса доступен только после входа.</p>
            <Button
              type="button"
              onClick={() => {
                void appHaptics.trigger("selection");
                openAuthModal("login");
              }}
            >
              Войти
            </Button>
          </section>
        ) : null}

        {tasteMapEnabled && status === "authed" && loadState === "loading" ? (
          <section className={classes.card}>
            <p className={classes.subtitle}>Загружаем профиль вкуса...</p>
          </section>
        ) : null}

        {tasteMapEnabled && status === "authed" && loadState === "error" ? (
          <section className={classes.card}>
            <p className={classes.title}>Ошибка загрузки</p>
            <p className={classes.error}>{error ?? "Не удалось загрузить данные."}</p>
            <Button
              type="button"
              onClick={() => {
                void appHaptics.trigger("selection");
                void loadTasteMap();
              }}
            >
              <IconRefresh size={16} />
              Повторить
            </Button>
          </section>
        ) : null}

        {tasteMapEnabled && status === "authed" && loadState === "ready" ? (
          <>
            <section className={classes.card}>
              <p className={classes.title}>Ваш вкус сейчас</p>
              <p className={classes.subtitle}>Активные теги влияют на персональные рекомендации.</p>
              {activeTags.length === 0 ? (
                <p className={classes.empty}>Пока нет активных тегов. Пройдите карту вкуса, чтобы запустить персонализацию.</p>
              ) : (
                <div className={classes.grid}>
                  {activeTags.map((tag: TasteMapTag) => (
                    <article key={`${tag.taste_code}:${tag.polarity}`} className={classes.tagItem}>
                      <div className={classes.tagTop}>
                        <p className={classes.tagTitle}>{getTasteLabel(tag.taste_code)}</p>
                        <span className={classes.badge} data-tone={tag.polarity}>
                          {getPolarityLabel(tag.polarity)}
                        </span>
                      </div>
                      <p className={classes.metrics}>
                        Сила: {toPercent(tag.score)}% · Уверенность: {toPercent(tag.confidence)}%
                      </p>
                      <p className={classes.metrics}>Источник: {getSourceLabel(tag.source)}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={classes.card}>
              <p className={classes.title}>Наши предположения</p>
              <p className={classes.subtitle}>
                Подтвердите или скройте гипотезы, чтобы точнее настраивать ваш профиль.
              </p>

              {actionError ? <p className={classes.error}>{actionError}</p> : null}
              {actionSuccess ? <p className={classes.subtitle}>{actionSuccess}</p> : null}

              {hypotheses.length === 0 ? (
                <p className={classes.empty}>Новых гипотез пока нет. Мы добавим их после накопления новых сигналов.</p>
              ) : (
                <div className={classes.hypothesisList}>
                  {hypotheses.map((item) => {
                    const isBusy = busyHypothesisID === item.id;
                    return (
                      <article key={item.id} className={classes.hypothesisItem}>
                        <div className={classes.hypothesisRow}>
                          <p className={classes.hypothesisTitle}>{getTasteLabel(item.taste_code)}</p>
                          <span className={classes.badge} data-tone={item.polarity}>
                            {getPolarityLabel(item.polarity)}
                          </span>
                        </div>
                        <p className={classes.hypothesisReason}>
                          {item.reason?.trim() || "Основано на ваших последних сигналах в отзывах и визитах."}
                        </p>
                        <p className={classes.meta}>
                          Уверенность: {toPercent(item.confidence)}% · обновлено {formatDate(item.updated_at)}
                        </p>
                        <div className={classes.hypothesisActions}>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void applyFeedback(item, "dismiss")}
                            disabled={isBusy}
                          >
                            <IconX size={15} />
                            Не про меня
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void applyFeedback(item, "accept")}
                            disabled={isBusy}
                          >
                            <IconCheck size={15} />
                            Подтвердить
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={classes.card}>
              <p className={classes.title}>Почему мы так думаем</p>
              <p className={classes.subtitle}>
                Объяснение формируется из вашей карты вкуса, отзывов, визитов и обратной связи по гипотезам.
              </p>
              <ul className={classes.insights}>
                {insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className={classes.card}>
              <p className={classes.title}>Обновить карту вкуса</p>
              <p className={classes.subtitle}>
                Если предпочтения изменились, пройдите onboarding заново. Мы перезапишем базовые сигналы.
              </p>
              <div className={classes.footer}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void appHaptics.trigger("medium");
                    void navigate("/taste/onboarding");
                  }}
                >
                  <IconRotate size={16} />
                  Пройти карту заново
                </Button>
                <p className={classes.meta}>
                  <IconBulb size={14} /> Данные обновляются автоматически после новых отзывов.
                </p>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
