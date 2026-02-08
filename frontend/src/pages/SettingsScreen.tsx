import {
  Box,
  Button,
  Container,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconCircleCheck,
  IconCircleX,
  IconMail,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as authApi from "../api/auth";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
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
  const { user, logout, status } = useAuth();
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
        <Group className={classes.header} justify="space-between">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            className={classes.ghostButton}
            onClick={() => navigate(-1)}
          >
            Назад
          </Button>

          <Text size="sm" className={classes.muted}>
            {settingsTitle}
          </Text>
        </Group>

        <Paper className={classes.card}>
          <div className={classes.cardContent}>
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
          </div>
        </Paper>
      </Container>
    </Box>
  );
}
