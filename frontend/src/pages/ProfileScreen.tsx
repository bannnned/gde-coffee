import {
  Box,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconId,
  IconLogout,
  IconMail,
  IconUser,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import classes from "./ProfileScreen.module.css";

export default function ProfileScreen() {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const { user, logout, openAuthModal, status } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const profile = useMemo(() => {
    const name =
      user?.name?.trim() || user?.displayName?.trim() || "Без имени";
    const email = user?.email?.trim() || "Email не указан";
    const id = user?.id ?? "—";
    const initial = (user?.name || user?.displayName || user?.email || "?")
      .trim()
      .charAt(0)
      .toUpperCase();

    return { name, email, id, initial };
  }, [user]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Box className={classes.screen} data-ui="profile-screen">
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

          <Text size="sm" c={scheme === "dark" ? "dimmed" : "gray.7"}>
            Профиль
          </Text>
        </Group>

        <Paper className={classes.card}>
          <div className={classes.cardContent}>
            {status === "loading" ? (
              <Text>Загружаем профиль...</Text>
            ) : !user ? (
              <Stack gap="md">
                <Title order={2}>Профиль недоступен</Title>
                <Text className={classes.subtitle}>
                  Войдите, чтобы увидеть данные аккаунта и управлять профилем.
                </Text>
                <Group className={classes.actions}>
                  <Button
                    variant="gradient"
                    gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                    onClick={() => openAuthModal("login")}
                  >
                    Войти
                  </Button>
                  <Button
                    variant="subtle"
                    className={classes.ghostButton}
                    onClick={() => navigate("/")}
                  >
                    На карту
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Stack gap="xl">
                <div className={classes.hero}>
                  <div className={classes.avatar}>{profile.initial}</div>
                  <div className={classes.heroText}>
                    <Title order={2}>{profile.name}</Title>
                    <Text className={classes.heroEmail}>{profile.email}</Text>
                    <Text className={classes.subtitle}>
                      Здесь будет история, избранные места и персональные
                      настройки.
                    </Text>
                  </div>
                  <div className={classes.heroMeta}
                    aria-label="Account ID"
                  >
                    <Text size="xs" c="dimmed">
                      ID аккаунта
                    </Text>
                    <Text fw={600}>{profile.id}</Text>
                  </div>
                </div>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Paper className={classes.infoItem}>
                    <Group gap="xs">
                      <IconUser size={16} />
                      <Text size="xs" c="dimmed">
                        Имя
                      </Text>
                    </Group>
                    <Text fw={600}>{profile.name}</Text>
                  </Paper>
                  <Paper className={classes.infoItem}>
                    <Group gap="xs">
                      <IconMail size={16} />
                      <Text size="xs" c="dimmed">
                        Email
                      </Text>
                    </Group>
                    <Text fw={600}>{profile.email}</Text>
                  </Paper>
                  <Paper className={classes.infoItem}>
                    <Group gap="xs">
                      <IconId size={16} />
                      <Text size="xs" c="dimmed">
                        Аккаунт
                      </Text>
                    </Group>
                    <Text fw={600}>Активен</Text>
                  </Paper>
                </SimpleGrid>

                <Group className={classes.actions}>
                  <Button
                    onClick={handleLogout}
                    loading={isLoggingOut}
                    leftSection={<IconLogout size={16} />}
                    variant="gradient"
                    gradient={{ from: "red.6", to: "orange.5", deg: 135 }}
                  >
                    Выход
                  </Button>
                  <Button
                    variant="subtle"
                    className={classes.ghostButton}
                    onClick={() => navigate("/")}
                  >
                    На карту
                  </Button>
                </Group>
              </Stack>
            )}
          </div>
        </Paper>
      </Container>
    </Box>
  );
}
