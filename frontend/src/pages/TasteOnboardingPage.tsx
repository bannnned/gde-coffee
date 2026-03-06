import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconRefresh,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { createJourneyID, reportMetricEvent } from "../api/metrics";
import {
  completeTasteOnboarding,
  getTasteOnboarding,
  type TasteOnboardingStep,
  type TasteOnboardingResponse,
} from "../api/taste";
import { useAuth } from "../components/AuthGate";
import { Button } from "../components/ui";
import { isTasteMapV1Enabled } from "../features/taste/model/flags";
import {
  clearTasteOnboardingProgress,
  loadTasteOnboardingProgress,
  saveTasteOnboardingProgress,
} from "../features/taste/model/onboardingProgress";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage, extractApiErrorStatus } from "../utils/apiError";
import classes from "./TasteOnboardingPage.module.css";

type AnswersMap = Record<string, unknown>;
type PairedChoice = "left" | "right" | "skip";

type LoadingState = "idle" | "loading" | "ready" | "error" | "feature-off";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getOptionIDs(step: TasteOnboardingStep): Set<string> {
  const values = (step.options ?? []).map((item) => item.id);
  return new Set(values);
}

function buildDefaultAnswerForStep(step: TasteOnboardingStep): unknown {
  if (step.type === "multi_choice") {
    return [] as string[];
  }
  if (step.type === "range") {
    const payload: Record<string, number> = {};
    for (const dimension of step.dimensions ?? []) {
      const midpoint = Math.round((dimension.min + dimension.max) / 2);
      payload[dimension.id] = midpoint;
    }
    return payload;
  }
  if (step.type === "paired_preference") {
    const payload: Record<string, PairedChoice> = {};
    for (const pair of step.pairs ?? []) {
      payload[pair.id] = "skip";
    }
    return payload;
  }
  return undefined;
}

function normalizeAnswerForStep(step: TasteOnboardingStep, raw: unknown): unknown {
  if (step.type === "single_choice") {
    if (typeof raw !== "string") return undefined;
    return getOptionIDs(step).has(raw) ? raw : undefined;
  }

  if (step.type === "multi_choice") {
    if (!Array.isArray(raw)) return [] as string[];
    const optionIDs = getOptionIDs(step);
    const unique: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string") continue;
      if (!optionIDs.has(item)) continue;
      if (unique.includes(item)) continue;
      unique.push(item);
    }
    const maxChoices = typeof step.max_choices === "number" && step.max_choices > 0
      ? step.max_choices
      : unique.length;
    return unique.slice(0, maxChoices);
  }

  if (step.type === "range") {
    const fallback = buildDefaultAnswerForStep(step) as Record<string, number>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fallback;
    }
    const input = raw as Record<string, unknown>;
    const payload: Record<string, number> = {};
    for (const dimension of step.dimensions ?? []) {
      const incoming = input[dimension.id];
      if (typeof incoming === "number" && Number.isFinite(incoming)) {
        payload[dimension.id] = clamp(Math.round(incoming), dimension.min, dimension.max);
      } else {
        payload[dimension.id] = fallback[dimension.id];
      }
    }
    return payload;
  }

  if (step.type === "paired_preference") {
    const fallback = buildDefaultAnswerForStep(step) as Record<string, PairedChoice>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return fallback;
    }
    const input = raw as Record<string, unknown>;
    const payload: Record<string, PairedChoice> = {};
    for (const pair of step.pairs ?? []) {
      const value = input[pair.id];
      if (value === "left" || value === "right" || value === "skip") {
        payload[pair.id] = value;
      } else {
        payload[pair.id] = fallback[pair.id];
      }
    }
    return payload;
  }

  return raw;
}

function initAnswers(steps: TasteOnboardingStep[], fromProgress: AnswersMap | null): AnswersMap {
  const result: AnswersMap = {};
  for (const step of steps) {
    const fallback = buildDefaultAnswerForStep(step);
    const raw = fromProgress ? fromProgress[step.id] : undefined;
    const normalized = normalizeAnswerForStep(step, raw);
    if (normalized !== undefined) {
      result[step.id] = normalized;
      continue;
    }
    if (fallback !== undefined) {
      result[step.id] = fallback;
    }
  }
  return result;
}

function validateStepAnswer(step: TasteOnboardingStep, value: unknown): string | null {
  if (step.type === "single_choice") {
    if (!step.required && (value === undefined || value === null || value === "")) {
      return null;
    }
    if (typeof value !== "string" || !getOptionIDs(step).has(value)) {
      return "Выберите один вариант.";
    }
    return null;
  }

  if (step.type === "multi_choice") {
    const options = getOptionIDs(step);
    const values = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && options.has(item))
      : [];
    const minChoices = Math.max(0, step.min_choices ?? (step.required ? 1 : 0));
    const maxChoices = Math.max(minChoices, step.max_choices ?? 99);
    if (values.length < minChoices) {
      return minChoices <= 1
        ? "Выберите минимум один вариант."
        : `Выберите минимум ${minChoices} варианта.`;
    }
    if (values.length > maxChoices) {
      return `Можно выбрать максимум ${maxChoices}.`;
    }
    return null;
  }

  if (step.type === "range") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "Укажите значения по шкалам.";
    }
    const payload = value as Record<string, unknown>;
    for (const dimension of step.dimensions ?? []) {
      const current = payload[dimension.id];
      if (typeof current !== "number" || Number.isNaN(current)) {
        return "Заполните все шкалы.";
      }
      if (current < dimension.min || current > dimension.max) {
        return "Одно из значений выходит за допустимый диапазон.";
      }
    }
    return null;
  }

  if (step.type === "paired_preference") {
    if (!step.required) return null;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "Выберите предпочтения в парах.";
    }
    const payload = value as Record<string, unknown>;
    const hasChoice = (step.pairs ?? []).some((pair) => payload[pair.id] === "left" || payload[pair.id] === "right");
    if (!hasChoice) {
      return "Сделайте выбор хотя бы в одной паре.";
    }
    return null;
  }

  return null;
}

function hasMeaningfulPairedChoice(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return Object.values(payload).some((item) => item === "left" || item === "right");
}

function serializeAnswers(steps: TasteOnboardingStep[], answers: AnswersMap) {
  return steps.flatMap((step) => {
    const value = answers[step.id];
    if (step.type === "single_choice") {
      if (typeof value !== "string") return [];
      return [{ question_id: step.id, value }];
    }

    if (step.type === "multi_choice") {
      if (!Array.isArray(value)) return [];
      const optionIDs = getOptionIDs(step);
      const normalized = value.filter((item): item is string => typeof item === "string" && optionIDs.has(item));
      if (!step.required && normalized.length === 0) return [];
      return [{ question_id: step.id, value: normalized }];
    }

    if (step.type === "range") {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      return [{ question_id: step.id, value }];
    }

    if (step.type === "paired_preference") {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return step.required ? [{ question_id: step.id, value: {} }] : [];
      }
      if (!step.required && !hasMeaningfulPairedChoice(value)) {
        return [];
      }
      return [{ question_id: step.id, value }];
    }

    return [];
  });
}

function computeStepProgress(stepIndex: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(Math.round(((stepIndex + 1) / total) * 100), 0, 100);
}

export default function TasteOnboardingPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, status, openAuthModal } = useAuth();

  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<TasteOnboardingResponse | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const journeyIDRef = useRef<string>(createJourneyID("taste_onboarding"));
  const startReportedVersionRef = useRef<string>("");

  const tasteMapEnabled = isTasteMapV1Enabled();
  const userID = (user?.id ?? "").trim();
  const backgroundLocation = (
    location.state as { backgroundLocation?: RouterLocation } | null
  )?.backgroundLocation;

  const steps = onboarding?.steps ?? [];
  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];
  const progress = computeStepProgress(stepIndex, totalSteps);

  const loadOnboarding = useCallback(async () => {
    if (!tasteMapEnabled) {
      setLoadingState("feature-off");
      return;
    }
    if (status !== "authed" || !userID) {
      return;
    }

    setLoadingState("loading");
    setLoadError(null);
    setSubmitError(null);

    try {
      const response = await getTasteOnboarding();
      const cachedProgress = loadTasteOnboardingProgress(userID);
      const canRestore = cachedProgress?.version === response.onboarding_version;
      const initialAnswers = initAnswers(response.steps, canRestore ? cachedProgress.answers : null);

      setOnboarding(response);
      setAnswers(initialAnswers);
      setStepIndex(
        canRestore
          ? clamp(cachedProgress.stepIndex, 0, Math.max(response.steps.length - 1, 0))
          : 0,
      );
      setLoadingState("ready");
      setIsCompleted(false);
      if (startReportedVersionRef.current !== response.onboarding_version) {
        startReportedVersionRef.current = response.onboarding_version;
        reportMetricEvent({
          event_type: "taste_onboarding_started",
          journey_id: journeyIDRef.current,
          meta: {
            onboarding_version: response.onboarding_version,
            source: "taste_onboarding_page",
          },
        });
      }
    } catch (error: unknown) {
      const statusCode = extractApiErrorStatus(error);
      if (statusCode === 404) {
        setLoadingState("feature-off");
      } else {
        setLoadError(extractApiErrorMessage(error, "Не удалось загрузить карту вкуса."));
        setLoadingState("error");
        reportMetricEvent({
          event_type: "taste_api_error",
          journey_id: journeyIDRef.current,
          meta: {
            stage: "load_onboarding",
            status_code: statusCode ?? 0,
            source: "taste_onboarding_page",
          },
        });
      }
    }
  }, [status, tasteMapEnabled, userID]);

  useEffect(() => {
    if (!tasteMapEnabled) {
      setLoadingState("feature-off");
      return;
    }
    if (status === "authed" && userID) {
      void loadOnboarding();
      return;
    }
    if (status === "loading") {
      setLoadingState("loading");
      return;
    }
    setLoadingState("idle");
  }, [loadOnboarding, status, tasteMapEnabled, userID]);

  useEffect(() => {
    if (!onboarding || !userID || loadingState !== "ready" || isCompleted) return;
    saveTasteOnboardingProgress(userID, {
      version: onboarding.onboarding_version,
      stepIndex,
      answers,
      updatedAt: new Date().toISOString(),
    });
  }, [answers, isCompleted, loadingState, onboarding, stepIndex, userID]);

  const goBack = useCallback(() => {
    if (stepIndex > 0 && !isCompleted) {
      setStepIndex((prev) => Math.max(0, prev - 1));
      setStepError(null);
      return;
    }
    if (backgroundLocation) {
      void navigate(-1);
      return;
    }
    void navigate("/profile");
  }, [backgroundLocation, isCompleted, navigate, stepIndex]);

  const updateAnswer = useCallback((stepID: string, value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [stepID]: value,
    }));
    setStepError(null);
    setSubmitError(null);
  }, []);

  const handleRestart = useCallback(() => {
    if (!onboarding) return;
    const freshAnswers = initAnswers(onboarding.steps, null);
    setAnswers(freshAnswers);
    setStepIndex(0);
    setStepError(null);
    setSubmitError(null);
    setIsCompleted(false);
    if (userID) {
      clearTasteOnboardingProgress(userID);
    }
  }, [onboarding, userID]);

  const submitAll = useCallback(async () => {
    if (!onboarding || !userID) return;

    for (let index = 0; index < onboarding.steps.length; index += 1) {
      const step = onboarding.steps[index];
      const validationError = validateStepAnswer(step, answers[step.id]);
      if (validationError) {
        setStepIndex(index);
        setStepError(validationError);
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = serializeAnswers(onboarding.steps, answers);
      await completeTasteOnboarding({
        onboarding_version: onboarding.onboarding_version,
        answers: payload,
        client_completed_at: new Date().toISOString(),
      });
      reportMetricEvent({
        event_type: "taste_onboarding_completed",
        journey_id: journeyIDRef.current,
        meta: {
          onboarding_version: onboarding.onboarding_version,
          answers_count: payload.length,
          source: "taste_onboarding_page",
        },
      });
      clearTasteOnboardingProgress(userID);
      setIsCompleted(true);
    } catch (error: unknown) {
      setSubmitError(extractApiErrorMessage(error, "Не удалось сохранить карту вкуса."));
      reportMetricEvent({
        event_type: "taste_api_error",
        journey_id: journeyIDRef.current,
        meta: {
          stage: "complete_onboarding",
          status_code: extractApiErrorStatus(error) ?? 0,
          source: "taste_onboarding_page",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, onboarding, userID]);

  const handleNext = useCallback(async () => {
    if (!currentStep || !onboarding) return;

    const validationError = validateStepAnswer(currentStep, answers[currentStep.id]);
    if (validationError) {
      setStepError(validationError);
      return;
    }

    if (stepIndex < onboarding.steps.length - 1) {
      setStepIndex((prev) => prev + 1);
      setStepError(null);
      return;
    }

    await submitAll();
  }, [answers, currentStep, onboarding, stepIndex, submitAll]);

  const title = useMemo(() => {
    if (!currentStep) return "Карта вкуса";
    return currentStep.title?.trim() || "Выберите вариант";
  }, [currentStep]);

  const subtitle = useMemo(() => {
    if (!currentStep) return "";
    return currentStep.subtitle?.trim() || "Ответы помогут точнее подбирать кофейни и напитки.";
  }, [currentStep]);

  return (
    <div className={classes.screen} data-ui="taste-onboarding-screen">
      <div className={classes.container}>
        <header className={classes.header}>
          <Button type="button" size="icon" variant="secondary" onClick={goBack} aria-label="Назад">
            <IconArrowLeft size={18} />
          </Button>
          <h1 className={classes.headerTitle}>Карта вкуса</h1>
          <div className={classes.headerSpacer} />
        </header>

        {!tasteMapEnabled || loadingState === "feature-off" ? (
          <section className={classes.card}>
            <p className={classes.title}>Карта вкуса временно недоступна</p>
            <p className={classes.subtitle}>
              Проверьте флаги фронта и бэка: `VITE_TASTE_MAP_V1_ENABLED=1` и `TASTE_MAP_V1_ENABLED=1`.
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
            <p className={classes.subtitle}>Карта вкуса доступна только после входа в аккаунт.</p>
            <Button type="button" onClick={() => openAuthModal("login")}>Войти</Button>
          </section>
        ) : null}

        {tasteMapEnabled && status === "authed" && loadingState === "loading" ? (
          <section className={classes.card}>
            <p className={classes.subtitle}>Загружаем вопросы...</p>
          </section>
        ) : null}

        {tasteMapEnabled && status === "authed" && loadingState === "error" ? (
          <section className={classes.card}>
            <p className={classes.title}>Не удалось загрузить онбординг</p>
            <p className={classes.error}>{loadError ?? "Повторите попытку."}</p>
            <div className={classes.footer}>
              <Button type="button" variant="secondary" onClick={() => void navigate("/profile")}>В профиль</Button>
              <Button type="button" onClick={() => void loadOnboarding()}>
                <IconRefresh size={16} />
                Повторить
              </Button>
            </div>
          </section>
        ) : null}

        {tasteMapEnabled && status === "authed" && loadingState === "ready" && onboarding && !isCompleted ? (
          <>
            <section className={classes.progressWrap}>
              <div className={classes.progressMeta}>
                <span>Шаг {stepIndex + 1} из {totalSteps}</span>
                <span>{progress}%</span>
              </div>
              <div className={classes.progressTrack}>
                <div className={classes.progressBar} style={{ width: `${progress}%` }} />
              </div>
            </section>

            <section className={classes.card}>
              <h2 className={classes.title}>{title}</h2>
              <p className={classes.subtitle}>{subtitle}</p>

              {currentStep?.type === "single_choice" ? (
                <div className={classes.optionGrid}>
                  {(currentStep.options ?? []).map((option) => {
                    const selected = answers[currentStep.id] === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`${classes.optionButton} ui-interactive ui-focus-ring`}
                        data-active={selected ? "true" : "false"}
                        onClick={() => updateAnswer(currentStep.id, option.id)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {currentStep?.type === "multi_choice" ? (
                <div className={classes.optionGrid}>
                  {(currentStep.options ?? []).map((option) => {
                    const selectedValues = Array.isArray(answers[currentStep.id])
                      ? (answers[currentStep.id] as string[])
                      : [];
                    const selected = selectedValues.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`${classes.optionButton} ui-interactive ui-focus-ring`}
                        data-active={selected ? "true" : "false"}
                        onClick={() => {
                          const next = selected
                            ? selectedValues.filter((item) => item !== option.id)
                            : [...selectedValues, option.id];
                          updateAnswer(currentStep.id, next);
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {currentStep?.type === "range" ? (
                <div className={classes.rangeList}>
                  {(currentStep.dimensions ?? []).map((dimension) => {
                    const currentValueMap = (answers[currentStep.id] as Record<string, number> | undefined) ?? {};
                    const value = typeof currentValueMap[dimension.id] === "number"
                      ? currentValueMap[dimension.id]
                      : Math.round((dimension.min + dimension.max) / 2);
                    return (
                      <label key={dimension.id} className={classes.rangeItem}>
                        <span className={classes.rangeLabel}>
                          <span>{dimension.label}</span>
                          <span className={classes.rangeValue}>{value}</span>
                        </span>
                        <input
                          type="range"
                          className={classes.slider}
                          min={dimension.min}
                          max={dimension.max}
                          step={1}
                          value={value}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            updateAnswer(currentStep.id, {
                              ...currentValueMap,
                              [dimension.id]: nextValue,
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {currentStep?.type === "paired_preference" ? (
                <div className={classes.optionGrid}>
                  {(currentStep.pairs ?? []).map((pair) => {
                    const answerMap = (answers[currentStep.id] as Record<string, PairedChoice> | undefined) ?? {};
                    const selected = answerMap[pair.id] ?? "skip";
                    const setChoice = (choice: PairedChoice) => {
                      updateAnswer(currentStep.id, {
                        ...answerMap,
                        [pair.id]: choice,
                      });
                    };
                    return (
                      <div key={pair.id} className={classes.pairCard}>
                        <div className={classes.pairControls}>
                          <button
                            type="button"
                            className={`${classes.optionButton} ui-interactive ui-focus-ring`}
                            data-active={selected === "left" ? "true" : "false"}
                            onClick={() => setChoice("left")}
                          >
                            {pair.left.label}
                          </button>
                          <button
                            type="button"
                            className={`${classes.optionButton} ui-interactive ui-focus-ring`}
                            data-active={selected === "right" ? "true" : "false"}
                            onClick={() => setChoice("right")}
                          >
                            {pair.right.label}
                          </button>
                          <button
                            type="button"
                            className={`${classes.optionButton} ${classes.skipButton} ui-interactive ui-focus-ring`}
                            data-active={selected === "skip" ? "true" : "false"}
                            onClick={() => setChoice("skip")}
                          >
                            Пропуск
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {stepError ? <p className={classes.error}>{stepError}</p> : null}
              {submitError ? <p className={classes.error}>{submitError}</p> : null}

              <div className={classes.footer}>
                <button
                  type="button"
                  className={`${classes.muted} ui-interactive`}
                  style={{ background: "none", border: "none", padding: 0 }}
                  onClick={handleRestart}
                >
                  Начать заново
                </button>
                <Button type="button" onClick={() => void handleNext()} disabled={isSubmitting}>
                  {stepIndex >= totalSteps - 1 ? (isSubmitting ? "Сохраняем..." : "Завершить") : "Дальше"}
                  <IconChevronRight size={16} />
                </Button>
              </div>
            </section>
          </>
        ) : null}

        {tasteMapEnabled && status === "authed" && loadingState === "ready" && isCompleted ? (
          <section className={classes.card}>
            <div className={classes.successBlock}>
              <p className={classes.title}>Карта вкуса сохранена</p>
              <p className={classes.subtitle}>
                Мы обновили ваш профиль вкуса. Теперь рекомендации будут точнее.
              </p>
              <div className={classes.footer}>
                <Button type="button" variant="secondary" onClick={handleRestart}>Пройти заново</Button>
                <Button type="button" onClick={() => void navigate("/profile")}> 
                  <IconCheck size={16} />
                  В профиль
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
