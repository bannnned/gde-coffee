import { Button, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as authApi from "../api/auth";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import classes from "./ConfirmPage.module.css";

export default function ConfirmEmailChangePage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState<string>("Подтверждаем смену email...");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Токен не найден. Проверьте ссылку из письма.");
      return;
    }

    authApi
      .confirmEmailChange(token)
      .then(() => {
        setStatus("success");
        setMessage("Готово! Email изменён.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err?.response?.data?.message ??
            err?.normalized?.message ??
            "Не удалось подтвердить смену email. Ссылка могла устареть.",
        );
      });
  }, [params]);

  return (
    <div className={classes.page}>
      <div className={classes.card}>
        <Stack gap="sm">
          <Title order={2} className={classes.title}>
            Смена email
          </Title>
          <Text className={classes.muted}>{message}</Text>
          <div className={classes.actions}>
            <Button
              variant="gradient"
              gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
              onClick={() => navigate("/settings?email_changed=1")}
              disabled={status === "loading"}
            >
              В настройки
            </Button>
            <Button variant="subtle" onClick={() => navigate("/")}
            >
              На главную
            </Button>
          </div>
        </Stack>
      </div>
    </div>
  );
}
