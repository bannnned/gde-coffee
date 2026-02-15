import {
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
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
import { IconBrandGithub, IconBrandYandex } from "@tabler/icons-react";

import type { AuthUser, LoginPayload, RegisterPayload } from "../api/auth";
import * as authApi from "../api/auth";
import { buildOAuthStartUrl } from "../api/url";
import TelegramLoginWidget from "./TelegramLoginWidget";

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
    } catch (err: any) {
      if (requestId !== meRequestId.current) return;
      const statusCode = err?.response?.status ?? err?.normalized?.status;
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
    loadMe();
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
    } catch (err: any) {
      const normalized = err?.normalized ?? {
        status: err?.response?.status,
        message: err?.response?.data?.message ?? err?.message,
      };
      const message =
        normalized?.message ??
        "Не удалось выполнить запрос. Проверьте данные и попробуйте еще раз.";
      if (!normalized?.status) {
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

  const inputStyles = useMemo(
    () => ({
      input: {
        borderRadius: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "inset 0 0 0 1px var(--color-surface-overlay-soft)",
        height: 48,
        fontSize: 14.5,
      },
      label: {
        fontWeight: 600,
        letterSpacing: 0.2,
      },
    }),
    [],
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
  const oauthIconProps = {
    size: 42,
    variant: "transparent" as const,
    className: "oauth-button",
  };

  return (
    <AuthContext.Provider value={ctxValue}>
      {children}

      <Modal
        opened={isAuthModalOpen}
        onClose={closeAuthModal}
        centered
        withCloseButton
        size="md"
        title={
          <Title order={3} style={{ margin: 0 }}>
            {titleText}
          </Title>
        }
        styles={{
          content: {
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow)",
            backdropFilter: "blur(18px) saturate(160%)",
            WebkitBackdropFilter: "blur(18px) saturate(160%)",
            borderRadius: 22,
          },
          header: {
            background: "transparent",
            borderBottom: "1px solid var(--border)",
            padding: "16px 18px 10px",
          },
          body: {
            padding: "10px 18px 20px",
          },
          overlay: {
            backdropFilter: "blur(8px)",
            backgroundColor: "var(--color-surface-overlay-strong)",
          },
        }}
      >
        <Box component="form" onSubmit={onSubmit}>
          <Stack gap="md">
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
                <TextInput
                  label="Email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  size="md"
                  radius="lg"
                  styles={inputStyles}
                  autoFocus
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  onFocus={handleFieldFocus}
                  name={field.name}
                  ref={field.ref}
                  error={errors.email?.message}
                />
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
                <PasswordInput
                  label="Пароль"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  size="md"
                  radius="lg"
                  styles={inputStyles}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  onFocus={handleFieldFocus}
                  name={field.name}
                  ref={field.ref}
                  error={errors.password?.message}
                />
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
                  <TextInput
                    label="Имя"
                    placeholder="Ваше имя"
                    size="md"
                    radius="lg"
                    styles={inputStyles}
                    autoComplete="name"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    onFocus={handleFieldFocus}
                    name={field.name}
                    ref={field.ref}
                    error={errors.name?.message}
                  />
                )}
              />
            )}

            {submitError && (
              <Text size="sm" c="red">
                {submitError}
              </Text>
            )}

            <Button
              type="submit"
              loading={isSubmitting}
              radius="lg"
              size="md"
              variant="gradient"
              gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
              styles={{
                root: {
                  height: 48,
                  boxShadow: "0 12px 24px var(--attention-glow)",
                },
              }}
            >
              {submitLabel}
            </Button>

            <Group gap="sm" justify="center">
              <ActionIcon
                {...oauthIconProps}
                aria-label="Войти через GitHub"
                title="GitHub"
                onClick={() => window.location.assign(githubAuthUrl)}
              >
                <IconBrandGithub size={22} />
              </ActionIcon>
              <ActionIcon
                {...oauthIconProps}
                aria-label="Войти через Яндекс"
                title="Яндекс"
                onClick={() => window.location.assign(yandexAuthUrl)}
              >
                <IconBrandYandex size={22} />
              </ActionIcon>
            </Group>

            <Box style={{ display: "flex", justifyContent: "center" }}>
              <TelegramLoginWidget flow="login" size="medium" />
            </Box>

            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {toggleText}
              </Text>
              <Button
                type="button"
                variant="subtle"
                size="xs"
                disabled={isSubmitting}
                onClick={() => {
                  setSubmitError(null);
                  setMode((prev) => (prev === "login" ? "register" : "login"));
                }}
              >
                {toggleLabel}
              </Button>
            </Group>
          </Stack>
        </Box>
      </Modal>
    </AuthContext.Provider>
  );
}
