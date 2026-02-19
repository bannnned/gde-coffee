import { ActionIcon, Box, Button, Paper, Stack, Text, Title } from "@mantine/core";
import { IconBrandGithub, IconBrandYandex } from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { buildOAuthStartUrl } from "../api/url";
import { useAuth } from "../components/AuthGate";
import TelegramLoginWidget from "../components/TelegramLoginWidget";
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

  const githubAuthUrl = useMemo(
    () => buildOAuthStartUrl("github"),
    [],
  );
  const yandexAuthUrl = useMemo(
    () => buildOAuthStartUrl("yandex"),
    [],
  );
  const oauthIconProps = {
    size: 42,
    variant: "transparent" as const,
    className: "oauth-button",
  };

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
                onClick={() => void navigate("/")}
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
            <div className={classes.oauthRow}>
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
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <TelegramLoginWidget flow="login" size="medium" />
            </div>
            <Button variant="subtle" onClick={() => void navigate("/")}>
              Вернуться назад
            </Button>
          </div>
        </Stack>
      </Paper>
    </Box>
  );
}
