import { type FormEventHandler, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as authApi from "../api/auth";
import { Button as UIButton, Input } from "../components/ui";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";
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
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const passwordValue = useWatch({ control, name: "password", defaultValue: "" });
  const submitDisabled = !token || isSubmitting;

  const submitForm = handleSubmit(async (values) => {
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
    } catch (err: unknown) {
      setSubmitError(extractApiErrorMessage(err, "Не удалось сменить пароль. Ссылка могла устареть."));
    }
  });

  const handleFormSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    void submitForm(event);
  };

  return (
    <main className={classes.page}>
      <section className={classes.card}>
        {success ? (
          <div className={classes.stack}>
            <h1 className={classes.title}>Пароль обновлён</h1>
            <p className={classes.muted}>
              Теперь можно войти с новым паролем.
            </p>
            <div className={classes.actions}>
              <UIButton
                type="button"
                onClick={() => {
                  void navigate("/");
                }}
              >
                На главную
              </UIButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit}>
            <div className={classes.stack}>
              <h1 className={classes.title}>Новый пароль</h1>
              <p className={classes.muted}>
                Придумайте новый пароль для аккаунта.
              </p>
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
                    <span className={classes.fieldLabel}>Новый пароль</span>
                    <Input
                      type="password"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className={classes.fieldInput}
                    />
                    {errors.password?.message ? (
                      <span className={classes.fieldError}>
                        {String(errors.password.message)}
                      </span>
                    ) : null}
                  </label>
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
                  <label className={classes.field}>
                    <span className={classes.fieldLabel}>Повторите пароль</span>
                    <Input
                      type="password"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className={classes.fieldInput}
                    />
                    {errors.confirmPassword?.message ? (
                      <span className={classes.fieldError}>
                        {String(errors.confirmPassword.message)}
                      </span>
                    ) : null}
                  </label>
                )}
              />
              {submitError && (
                <p className={classes.errorText}>
                  {submitError}
                </p>
              )}
              <div className={classes.actions}>
                <UIButton
                  type="submit"
                  disabled={submitDisabled}
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Сохраняем...
                    </>
                  ) : (
                    "Сменить пароль"
                  )}
                </UIButton>
                <UIButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void navigate("/");
                  }}
                >
                  На главную
                </UIButton>
              </div>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
