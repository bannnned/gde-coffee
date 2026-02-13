import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBrandGithub,
  IconBrandTelegram,
  IconBrandYandex,
  IconCircleCheck,
  IconCircleX,
  IconMail,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, type FocusEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as authApi from "../api/auth";
import TelegramLoginWidget from "../components/TelegramLoginWidget";
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

export default function SettingsScreen() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout, status, refreshAuth } = useAuth();
  const [identities, setIdentities] = useState<authApi.AuthIdentity[]>([]);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [isIdentitiesLoading, setIsIdentitiesLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [emailChangeResult, setEmailChangeResult] = useState<string | null>(null);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const verifiedParam = searchParams.get("verified") === "1";
  const emailChangedParam = searchParams.get("email_changed") === "1";

  const isVerified = Boolean(
    user?.emailVerifiedAt ||
      (user as any)?.email_verified_at ||
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

  const githubAuthUrl = useMemo(() => {
    const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    return base
      ? `${base}/api/auth/github/link/start`
      : "/api/auth/github/link/start";
  }, []);

  const yandexAuthUrl = useMemo(() => {
    const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    return base
      ? `${base}/api/auth/yandex/link/start`
      : "/api/auth/yandex/link/start";
  }, []);

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

  const isProviderLinked = useCallback(
    (providerName: string) =>
      identities.some((identity) => {
        const provider =
          identity.provider ?? identity.type ?? identity.name ?? "";
        return provider.toString().toLowerCase() === providerName;
      }),
    [identities],
  );

  const githubLinked = useMemo(
    () => isProviderLinked("github"),
    [isProviderLinked],
  );
  const yandexLinked = useMemo(
    () => isProviderLinked("yandex"),
    [isProviderLinked],
  );
  const telegramLinked = useMemo(
    () => isProviderLinked("telegram"),
    [isProviderLinked],
  );

  const githubStatusLabel = githubLinked ? "подключён" : "не подключён";
  const githubStatusTone = githubLinked ? "ok" : "warn";
  const yandexStatusLabel = yandexLinked ? "подключён" : "не подключён";
  const yandexStatusTone = yandexLinked ? "ok" : "warn";
  const telegramStatusLabel = telegramLinked ? "подключён" : "не подключён";
  const telegramStatusTone = telegramLinked ? "ok" : "warn";

  const refreshIdentities = useCallback(async () => {
    if (status !== "authed") {
      setIdentities([]);
      return;
    }
    setIsIdentitiesLoading(true);
    setIdentityError(null);
    try {
      const list = await authApi.getIdentities();
      setIdentities(list);
    } catch (err: any) {
      const statusCode = err?.response?.status ?? err?.normalized?.status;
      if (statusCode && statusCode !== 404) {
        setIdentityError(
          err?.response?.data?.message ??
            err?.normalized?.message ??
            "Не удалось обновить список привязок.",
        );
      }
      setIdentities([]);
    } finally {
      setIsIdentitiesLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authed") return;
    refreshIdentities();
  }, [refreshIdentities, status]);

  useOauthRedirect({
    onResultOk: refreshAuth,
    onResultLinked: refreshIdentities,
  });

  const handleVerifyRequest = async () => {
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      await authApi.requestEmailVerification();
      setVerifySuccess("Письмо отправлено. Проверьте почту.");
    } catch (err: any) {
      setVerifyError(
        err?.response?.data?.message ??
          err?.normalized?.message ??
          "Не удалось отправить письмо. Попробуйте позже.",
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
    } catch (err: any) {
      setEmailChangeError(
        err?.response?.data?.message ??
          err?.normalized?.message ??
          "Не удалось отправить запрос. Проверьте данные.",
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
    } catch (err: any) {
      setResetError(
        err?.response?.data?.message ??
          err?.normalized?.message ??
          "Не удалось отправить письмо. Попробуйте позже.",
      );
    }
  });

  const settingsTitle = useMemo(
    () => (status === "loading" ? "Загружаем аккаунт..." : "Аккаунт / Настройки"),
    [status],
  );

  return (
    <Box className={classes.screen} data-ui="settings-screen">
      <Container className={classes.container}>
        <header className={classes.header}>
          <ActionIcon
            size={42}
            variant="transparent"
            className={`${classes.iconButton} glass-action glass-action--square`}
            onClick={() => navigate("/profile")}
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
                  onClick={handleVerifyRequest}
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
                  <IconBrandGithub size={18} />
                  <Title order={4}>Подключить GitHub</Title>
                </Group>
              </div>
              <div className={classes.statusLine}>
                <span
                  className={classes.statusPill}
                  data-status={githubStatusTone}
                >
                  {githubLinked ? (
                    <IconCircleCheck size={14} />
                  ) : (
                    <IconCircleX size={14} />
                  )}
                  {githubStatusLabel}
                </span>
              </div>
              <Text size="sm" className={classes.muted} mt={4}>
                Подключите GitHub, чтобы привязать аккаунт к профилю.
              </Text>
              <Group className={classes.actionsRow} mt="md">
                <Button
                  variant="filled"
                  className={classes.actionButton}
                  onClick={() => window.location.assign(githubAuthUrl)}
                  leftSection={<IconBrandGithub size={16} />}
                  disabled={status !== "authed" || isIdentitiesLoading}
                  loading={isIdentitiesLoading}
                >
                  Подключить GitHub
                </Button>
              </Group>
              {identityError && (
                <div className={classes.error} style={{ marginTop: 12 }}>
                  {identityError}
                </div>
              )}
            </div>

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <Group gap="xs">
                  <IconBrandYandex size={18} />
                  <Title order={4}>Подключить Яндекс</Title>
                </Group>
              </div>
              <div className={classes.statusLine}>
                <span
                  className={classes.statusPill}
                  data-status={yandexStatusTone}
                >
                  {yandexLinked ? (
                    <IconCircleCheck size={14} />
                  ) : (
                    <IconCircleX size={14} />
                  )}
                  {yandexStatusLabel}
                </span>
              </div>
              <Text size="sm" className={classes.muted} mt={4}>
                Подключите Яндекс, чтобы привязать аккаунт к профилю.
              </Text>
              <Group className={classes.actionsRow} mt="md">
                <Button
                  variant="filled"
                  className={classes.actionButton}
                  onClick={() => window.location.assign(yandexAuthUrl)}
                  leftSection={<IconBrandYandex size={16} />}
                  disabled={status !== "authed" || isIdentitiesLoading}
                  loading={isIdentitiesLoading}
                >
                  Подключить Яндекс
                </Button>
              </Group>
              {identityError && (
                <div className={classes.error} style={{ marginTop: 12 }}>
                  {identityError}
                </div>
              )}
            </div>

            <div className={classes.section}>
              <div className={classes.sectionHeader}>
                <Group gap="xs">
                  <IconBrandTelegram size={18} />
                  <Title order={4}>Подключить Telegram</Title>
                </Group>
              </div>
              <div className={classes.statusLine}>
                <span
                  className={classes.statusPill}
                  data-status={telegramStatusTone}
                >
                  {telegramLinked ? (
                    <IconCircleCheck size={14} />
                  ) : (
                    <IconCircleX size={14} />
                  )}
                  {telegramStatusLabel}
                </span>
              </div>
              <Text size="sm" className={classes.muted} mt={4}>
                Подключите Telegram, чтобы привязать аккаунт к профилю.
              </Text>
              <Group className={classes.actionsRow} mt="md">
                <TelegramLoginWidget flow="link" size="medium" />
              </Group>
              {identityError && (
                <div className={classes.error} style={{ marginTop: 12 }}>
                  {identityError}
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
              <Box component="form" onSubmit={onEmailChangeSubmit}>
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
              <Box component="form" onSubmit={onResetSubmit}>
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
                  <IconShieldCheck size={18} />
                  <Title order={4}>Сессия</Title>
                </Group>
              </div>
              <Group className={classes.actionsRow}>
                <Button
                  onClick={logout}
                  variant="filled"
                  className={classes.actionButtonDanger}
                >
                  Выйти из аккаунта
                </Button>
              </Group>
            </div>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
