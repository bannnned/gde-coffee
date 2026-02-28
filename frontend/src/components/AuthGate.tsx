import { IconBrandGithub, IconBrandYandex } from "@tabler/icons-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PropsWithChildren,
} from "react";
import { Controller, useForm } from "react-hook-form";

import type { AuthUser, LoginPayload, RegisterPayload } from "../api/auth";
import * as authApi from "../api/auth";
import { buildOAuthStartUrl } from "../api/url";
import { Button as UIButton, Input } from "../components/ui";
import { AppModal } from "../ui/bridge";
import TelegramLoginWidget from "./TelegramLoginWidget";
import classes from "./AuthGate.module.css";

type AuthStatus = "loading" | "authed" | "unauth" | "error";
type AuthFormMode = "login" | "register";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  openAuthModal: (mode?: AuthFormMode) => void;
  closeAuthModal: () => void;
  isAuthModalOpen: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthFormValues = {
  email: string;
  password: string;
  name: string;
};

type AuthErrorLike = {
  normalized?: {
    status?: number;
    message?: string;
  };
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

function extractAuthError(error: unknown): { status?: number; message?: string } {
  if (!error || typeof error !== "object") {
    return {};
  }
  const err = error as AuthErrorLike;
  return {
    status: err.normalized?.status ?? err.response?.status,
    message: err.normalized?.message ?? err.response?.data?.message ?? err.message,
  };
}

const defaultFormValues: AuthFormValues = {
  email: "",
  password: "",
  name: "",
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthGate");
  }
  return ctx;
}

export default function AuthGate({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthFormMode>("login");
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const meRequestId = useRef(0);

  const isRegister = mode === "register";
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    defaultValues: defaultFormValues,
    mode: "onBlur",
    shouldUnregister: true,
  });

  const loadMe = useCallback(async () => {
    const requestId = ++meRequestId.current;
    try {
      setStatus("loading");
      setSubmitError(null);
      const me = await authApi.me();
      if (requestId !== meRequestId.current) return;
      setUser(me);
      setStatus("authed");
    } catch (error: unknown) {
      if (requestId !== meRequestId.current) return;
      const { status: statusCode } = extractAuthError(error);
      if (statusCode === 401) {
        setUser(null);
        setStatus("unauth");
      } else {
        setStatus("error");
        setSubmitError("Не удалось проверить авторизацию. Попробуйте еще раз.");
      }
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const email = values.email.trim();
      const password = values.password;
      const displayName = values.name?.trim() ?? "";
      let nextUser: AuthUser | null = null;

      if (mode === "login") {
        const payload: LoginPayload = {
          email,
          password,
        };
        nextUser = await authApi.login(payload);
      } else {
        const payload: RegisterPayload = {
          email,
          password,
          displayName,
        };
        nextUser = await authApi.register(payload);
      }
      if (nextUser) {
        setUser(nextUser);
        setStatus("authed");
      }
      await loadMe();
      setAuthModalOpen(false);
      reset(defaultFormValues);
    } catch (error: unknown) {
      const { status, message: rawMessage } = extractAuthError(error);
      const message =
        rawMessage ??
        "Не удалось выполнить запрос. Проверьте данные и попробуйте еще раз.";
      if (!status) {
        setSubmitError(`${message} Проверьте API адрес или dev-proxy.`);
      } else {
        setSubmitError(message);
      }
    }
  });

  const logout = useCallback(async () => {
    meRequestId.current += 1;
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("unauth");
    }
  }, []);

  const openAuthModal = useCallback((nextMode: AuthFormMode = "login") => {
    setMode(nextMode);
    setSubmitError(null);
    reset(defaultFormValues);
    setAuthModalOpen(true);
  }, [reset]);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setSubmitError(null);
    reset(defaultFormValues);
  }, [reset]);

  const ctxValue = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      logout,
      refreshAuth: loadMe,
      openAuthModal,
      closeAuthModal,
      isAuthModalOpen,
    }),
    [
      logout,
      status,
      user,
      openAuthModal,
      closeAuthModal,
      isAuthModalOpen,
      loadMe,
    ],
  );

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    const target = event.currentTarget;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const githubAuthUrl = useMemo(() => buildOAuthStartUrl("github"), []);
  const yandexAuthUrl = useMemo(() => buildOAuthStartUrl("yandex"), []);

  const titleText = isRegister ? "Регистрация" : "Вход";
  const submitLabel = isRegister ? "Создать аккаунт" : "Войти";
  const toggleLabel = isRegister ? "Войти" : "Регистрация";
  const toggleText = isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?";

  return (
    <AuthContext.Provider value={ctxValue}>
      {children}

      <AppModal
        open={isAuthModalOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setAuthModalOpen(true);
            return;
          }
          closeAuthModal();
        }}
        title={<span className={classes.title}>{titleText}</span>}
        centered
        closeButton
        implementation="radix"
        presentation="dialog"
        contentClassName={classes.modalContent}
        bodyClassName={classes.modalBody}
        titleClassName={classes.titleWrapper}
      >
        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className={classes.form}
        >
          <div className={classes.fields}>
            <Controller
              name="email"
              control={control}
              rules={{
                required: "Введите email",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Введите корректный email",
                },
              }}
              render={({ field }) => (
                <label className={classes.field}>
                  <span className={classes.label}>Email</span>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    autoFocus
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    onFocus={handleFieldFocus}
                    name={field.name}
                    ref={field.ref}
                    className={classes.input}
                  />
                  {errors.email?.message ? (
                    <span className={classes.errorText}>{errors.email.message}</span>
                  ) : null}
                </label>
              )}
            />
            <Controller
              name="password"
              control={control}
              rules={{
                required: "Введите пароль",
                minLength: { value: 8, message: "Минимум 8 символов" },
                maxLength: { value: 128, message: "Максимум 128 символов" },
                validate: (value) =>
                  /[A-Za-z]/.test(value) && /\d/.test(value)
                    ? true
                    : "Пароль должен содержать буквы и цифры",
              }}
              render={({ field }) => (
                <label className={classes.field}>
                  <span className={classes.label}>Пароль</span>
                  <Input
                    type="password"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    onFocus={handleFieldFocus}
                    name={field.name}
                    ref={field.ref}
                    className={classes.input}
                  />
                  {errors.password?.message ? (
                    <span className={classes.errorText}>{errors.password.message}</span>
                  ) : null}
                </label>
              )}
            />
            {isRegister && (
              <Controller
                name="name"
                control={control}
                rules={{
                  validate: (value) => {
                    if (!value) return true;
                    const trimmed = value.trim();
                    if (trimmed.length < 2) {
                      return "Минимум 2 символа";
                    }
                    if (trimmed.length > 50) {
                      return "Максимум 50 символов";
                    }
                    if (!/^[\p{L}][\p{L}\s'-]*$/u.test(trimmed)) {
                      return "Только буквы, пробелы, дефис и апостроф";
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <label className={classes.field}>
                    <span className={classes.label}>Имя</span>
                    <Input
                      type="text"
                      placeholder="Ваше имя"
                      autoComplete="name"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      onFocus={handleFieldFocus}
                      name={field.name}
                      ref={field.ref}
                      className={classes.input}
                    />
                    {errors.name?.message ? (
                      <span className={classes.errorText}>{errors.name.message}</span>
                    ) : null}
                  </label>
                )}
              />
            )}

            {submitError && (
              <p className={classes.submitError}>
                {submitError}
              </p>
            )}
          </div>

          <UIButton
            type="submit"
            className={classes.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Отправляем...
              </>
            ) : (
              submitLabel
            )}
          </UIButton>

          <div className={classes.oauthRow}>
            <button
              type="button"
              className="oauth-button ui-focus-ring"
              aria-label="Войти через GitHub"
              title="GitHub"
              onClick={() => window.location.assign(githubAuthUrl)}
            >
              <IconBrandGithub size={22} />
            </button>
            <button
              type="button"
              className="oauth-button ui-focus-ring"
              aria-label="Войти через Яндекс"
              title="Яндекс"
              onClick={() => window.location.assign(yandexAuthUrl)}
            >
              <IconBrandYandex size={22} />
            </button>
          </div>

          <div className={classes.telegramRow}>
            <TelegramLoginWidget flow="login" size="medium" />
          </div>

          <div className={classes.toggleRow}>
            <p className={classes.toggleText}>{toggleText}</p>
            <UIButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={() => {
                setSubmitError(null);
                setMode((prev) => (prev === "login" ? "register" : "login"));
              }}
            >
              {toggleLabel}
            </UIButton>
          </div>
        </form>
      </AppModal>
    </AuthContext.Provider>
  );
}
