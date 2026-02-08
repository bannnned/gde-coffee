import {
  Button,
  PasswordInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as authApi from "../api/auth";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import classes from "./ConfirmPage.module.css";

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

export default function ResetPasswordPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const passwordValue = watch("password");
  const submitDisabled = useMemo(
    () => !token || isSubmitting,
    [token, isSubmitting],
  );

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setSubmitError("Токен не найден. Проверьте ссылку из письма.");
      return;
    }
    setSubmitError(null);
    try {
      await authApi.confirmPasswordReset({
        token,
        newPassword: values.password,
      });
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message ??
          err?.normalized?.message ??
          "Не удалось сменить пароль. Ссылка могла устареть.",
      );
    }
  });

  return (
    <div className={classes.page}>
      <div className={classes.card}>
        {success ? (
          <Stack gap="sm">
            <Title order={2} className={classes.title}>
              Пароль обновлён
            </Title>
            <Text className={classes.muted}>
              Теперь можно войти с новым паролем.
            </Text>
            <div className={classes.actions}>
              <Button
                variant="gradient"
                gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                onClick={() => navigate("/")}
              >
                На главную
              </Button>
            </div>
          </Stack>
        ) : (
          <form onSubmit={onSubmit}>
            <Stack gap="sm">
              <Title order={2} className={classes.title}>
                Новый пароль
              </Title>
              <Text className={classes.muted}>
                Придумайте новый пароль для аккаунта.
              </Text>
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
                    label="Новый пароль"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    error={errors.password?.message}
                  />
                )}
              />
              <Controller
                name="confirmPassword"
                control={control}
                rules={{
                  validate: (value) =>
                    value === passwordValue ? true : "Пароли не совпадают",
                }}
                render={({ field }) => (
                  <PasswordInput
                    label="Повторите пароль"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    error={errors.confirmPassword?.message}
                  />
                )}
              />
              {submitError && (
                <Text c="red" size="sm">
                  {submitError}
                </Text>
              )}
              <div className={classes.actions}>
                <Button
                  type="submit"
                  loading={isSubmitting}
                  disabled={submitDisabled}
                  variant="gradient"
                  gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                >
                  Сменить пароль
                </Button>
                <Button variant="subtle" onClick={() => navigate("/")}
                >
                  На главную
                </Button>
              </div>
            </Stack>
          </form>
        )}
      </div>
    </div>
  );
}
