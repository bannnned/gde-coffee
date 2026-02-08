import { Box, Button, Paper, Stack, Text, Title } from "@mantine/core";
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import useOauthRedirect from "../hooks/useOauthRedirect";
import classes from "./LoginPage.module.css";

export default function LoginPage() {
  useAllowBodyScroll();
  const { openAuthModal, status, user, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoOpenedRef = useRef(false);

  const { hasOauthParams } = useOauthRedirect({
    onResultOk: refreshAuth,
  });

  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (status !== "unauth" || hasOauthParams) return;
    autoOpenedRef.current = true;
    openAuthModal("login");
  }, [hasOauthParams, openAuthModal, status]);

  const hasSearch = searchParams.toString().length > 0;

  return (
    <Box className={classes.page} data-ui="login-screen">
      <Paper className={classes.card}>
        <Stack gap="md">
          <Title order={2}>Вход</Title>
          {status === "authed" && user ? (
            <Text className={classes.muted}>
              Вы уже вошли как {user.email ?? "пользователь"}.
            </Text>
          ) : status === "loading" || hasSearch ? (
            <Text className={classes.muted}>
              Проверяем авторизацию. Если нужно, откройте форму входа.
            </Text>
          ) : (
            <Text className={classes.muted}>
              Войдите, чтобы получить доступ к профилю и настройкам.
            </Text>
          )}
          <div className={classes.actions}>
            {status === "authed" ? (
              <Button
                variant="gradient"
                gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                onClick={() => navigate("/")}
              >
                На главную
              </Button>
            ) : (
              <Button
                variant="gradient"
                gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                onClick={() => openAuthModal("login")}
              >
                Открыть форму входа
              </Button>
            )}
            <Button variant="subtle" onClick={() => navigate("/")}>
              Вернуться назад
            </Button>
          </div>
        </Stack>
      </Paper>
    </Box>
  );
}
