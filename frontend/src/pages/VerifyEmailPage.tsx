import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as authApi from "../api/auth";
import { Button as UIButton } from "../components/ui";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";
import classes from "./ConfirmPage.module.css";

export default function VerifyEmailPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState<string>(
    token ? "Подтверждаем email..." : "Токен не найден. Проверьте ссылку из письма.",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    authApi
      .confirmEmailVerification(token)
      .then(() => {
        if (cancelled) return;
        setStatus("success");
        setMessage("Готово");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(extractApiErrorMessage(err, "Не удалось подтвердить email. Ссылка могла устареть."));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className={classes.page}>
      <section className={classes.card}>
        <div className={classes.stack}>
          <h1 className={classes.title}>Подтверждение email</h1>
          <p className={classes.muted}>{message}</p>
          <div className={classes.actions}>
            <UIButton
              type="button"
              onClick={() => {
                void navigate("/settings?verified=1");
              }}
              disabled={status === "loading"}
            >
              В настройки
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
      </section>
    </main>
  );
}
