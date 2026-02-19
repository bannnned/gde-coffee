import { Button, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as authApi from "../api/auth";
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
    <div className={classes.page}>
      <div className={classes.card}>
        <Stack gap="sm">
          <Title order={2} className={classes.title}>
            Подтверждение email
          </Title>
          <Text className={classes.muted}>{message}</Text>
          <div className={classes.actions}>
              <Button
                variant="gradient"
                gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                onClick={() => void navigate("/settings?verified=1")}
                disabled={status === "loading"}
              >
                В настройки
              </Button>
            <Button variant="subtle" onClick={() => void navigate("/")}>
              На главную
            </Button>
          </div>
        </Stack>
      </div>
    </div>
  );
}
