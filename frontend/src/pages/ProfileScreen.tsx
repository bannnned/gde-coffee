import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconAt,
  IconCheck,
  IconChecklist,
  IconCrown,
  IconId,
  IconLogout,
  IconMail,
  IconSettings,
  IconTrophy,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { resolveAvatarUrl } from "../utils/resolveAvatarUrl";
import classes from "./ProfileScreen.module.css";

export default function ProfileScreen() {
  const { user, logout, openAuthModal, status } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useAllowBodyScroll();

  const profile = useMemo(() => {
    const name =
      user?.name?.trim() || user?.displayName?.trim() || "Без имени";
    const email = user?.email?.trim() || "Email не указан";
    const id = user?.id ?? "—";
    const initial = (user?.name || user?.displayName || user?.email || "?")
      .trim()
      .charAt(0)
      .toUpperCase();
    const username = email.includes("@") ? email.split("@")[0] : email;
    const isVerified = Boolean(user?.emailVerifiedAt);
    const avatarUrl = resolveAvatarUrl(user?.avatarUrl);

    return { name, email, id, initial, username, isVerified, avatarUrl };
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
        <header className={classes.header}>
          <ActionIcon
            size={42}
            variant="transparent"
            className={`${classes.iconButton} glass-action glass-action--square`}
            onClick={() => navigate("/")}
            aria-label="Назад"
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Text size="sm" className={classes.headerTitle}>
            Профиль
          </Text>
          <ActionIcon
            size={42}
            variant="transparent"
            className={`${classes.iconButton} glass-action glass-action--square`}
            onClick={() => navigate("/settings")}
            aria-label="Настройки"
          >
            <IconSettings size={18} />
          </ActionIcon>
        </header>

        <Stack gap="lg">
          <Paper className={classes.profileCard}>
            {status === "loading" ? (
              <Text>Загружаем профиль...</Text>
            ) : !user ? (
              <Stack gap="md">
                <div className={classes.avatarLarge}>?</div>
                <Title order={2}>Профиль недоступен</Title>
                <Text className={classes.subtitle}>
                  Войдите, чтобы увидеть данные аккаунта и управлять профилем.
                </Text>
                <Button
                  variant="gradient"
                  gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                  onClick={() => openAuthModal("login")}
                >
                  Войти
                </Button>
              </Stack>
            ) : (
              <Stack gap="md">
                <div className={classes.hero}>
                  <div className={classes.avatarLarge}>
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={profile.name}
                        className={classes.avatarImage}
                        loading="lazy"
                      />
                    ) : (
                      profile.initial
                    )}
                  </div>
                  <div className={classes.heroText}>
                    <Title order={2}>{profile.name}</Title>
                    <Text className={classes.heroCaption}>
                      Здесь будет история, избранные места и персональные
                      настройки.
                    </Text>
                  </div>
                </div>

            <div className={classes.listCard}>
              <div className={classes.listRow}>
                <div className={classes.listIcon}>
                  <IconAt size={18} />
                </div>
                <div className={classes.listText}>
                  <Text fw={600}>@{profile.username}</Text>
                </div>
              </div>
              <div className={classes.listRow}>
                <div className={classes.listIcon}>
                  <IconMail size={18} />
                </div>
                <div className={classes.listText}>
                  <Text fw={600} className={classes.listPrimary}>
                    {profile.email}
                  </Text>
                </div>
                <div className={classes.rowMeta}>
                  {profile.isVerified && (
                    <span
                      className={classes.verifiedBadge}
                      aria-label="Email подтверждён"
                    >
                      <IconCheck size={12} />
                    </span>
                  )}
                </div>
              </div>
              <div className={classes.listRow}>
                <div className={classes.listIcon}>
                  <IconId size={18} />
                </div>
                <div className={classes.listText}>
                  <Text fw={600}>ID аккаунта</Text>
                  <Text size="xs" className={classes.muted}>
                    {profile.id}
                  </Text>
                </div>
              </div>
            </div>
              </Stack>
            )}
          </Paper>

          <section className={`${classes.sectionCard} ${classes.disabledSection}`}>
            <div className={classes.sectionHeader}>
              <Group gap="xs">
                <IconTrophy size={18} />
                <Text fw={600}>Ачивки</Text>
              </Group>
              <Text size="sm" className={classes.sectionAction}>
                Смотреть всё
              </Text>
            </div>
            <div className={classes.placeholderCard}>
              <IconCrown size={24} />
              <div>
                <Text fw={600}>Новичок</Text>
                <Text size="sm" className={classes.muted}>
                  Скоро появятся достижения
                </Text>
              </div>
            </div>
          </section>

          <section className={`${classes.sectionCard} ${classes.disabledSection}`}>
            <div className={classes.sectionHeader}>
              <Group gap="xs">
                <IconChecklist size={18} />
                <Text fw={600}>Задания</Text>
              </Group>
              <Text size="sm" className={classes.sectionAction}>
                Смотреть всё
              </Text>
            </div>
            <div className={classes.placeholderCard}>
              <IconChecklist size={24} />
              <div>
                <Text fw={600}>Скоро</Text>
                <Text size="sm" className={classes.muted}>
                  Задания появятся позже
                </Text>
              </div>
            </div>
          </section>

          <section className={`${classes.sectionCard} ${classes.disabledSection}`}>
            <div className={classes.sectionHeader}>
              <Group gap="xs">
                <IconCrown size={18} />
                <Text fw={600}>Ваш уровень</Text>
              </Group>
            </div>
            <div className={classes.levelCard}>
              <div>
                <Text fw={600}>Lv. 1</Text>
                <Text size="sm" className={classes.muted}>
                  Прокачка появится позже
                </Text>
              </div>
              <div className={classes.levelBar}>
                <div className={classes.levelBarFill} />
              </div>
            </div>
          </section>

          {user && (
            <Button
              onClick={handleLogout}
              loading={isLoggingOut}
              leftSection={<IconLogout size={16} />}
              variant="gradient"
              gradient={{ from: "red.6", to: "orange.5", deg: 135 }}
              className={classes.logoutButton}
            >
              Выйти
            </Button>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
