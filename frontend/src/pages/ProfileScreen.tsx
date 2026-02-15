import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBrandGithub,
  IconBrandTelegram,
  IconBrandYandex,
  IconCheck,
  IconChecklist,
  IconCircleCheck,
  IconCircleX,
  IconCrown,
  IconId,
  IconLink,
  IconLogout,
  IconMail,
  IconPlus,
  IconPencil,
  IconSettings,
  IconTrophy,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import * as authApi from "../api/auth";
import { useAuth } from "../components/AuthGate";
import TelegramLoginWidget from "../components/TelegramLoginWidget";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import useOauthRedirect from "../hooks/useOauthRedirect";
import { resolveAvatarUrl } from "../utils/resolveAvatarUrl";
import classes from "./ProfileScreen.module.css";

export default function ProfileScreen() {
  const { user, logout, openAuthModal, status, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [identities, setIdentities] = useState<authApi.AuthIdentity[]>([]);
  const [isIdentitiesLoading, setIsIdentitiesLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [isNameSaving, setIsNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);

  useAllowBodyScroll();

  const profile = useMemo(() => {
    const name = user?.name?.trim() || user?.displayName?.trim() || "Без имени";
    const email = user?.email?.trim() || "Email не указан";
    const id = user?.id ?? "—";
    const initial = (user?.name || user?.displayName || user?.email || "?")
      .trim()
      .charAt(0)
      .toUpperCase();
    const isVerified = Boolean(user?.emailVerifiedAt);
    const avatarUrl = resolveAvatarUrl(user?.avatarUrl);

    return { name, email, id, initial, isVerified, avatarUrl };
  }, [user]);

  const editableName = useMemo(
    () => user?.displayName?.trim() || user?.name?.trim() || "",
    [user],
  );

  useEffect(() => {
    setNameDraft(editableName);
  }, [editableName]);

  const githubAuthUrl = useMemo(() => {
    const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    return base ? `${base}/api/auth/github/link/start` : "/api/auth/github/link/start";
  }, []);

  const yandexAuthUrl = useMemo(() => {
    const base = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    return base ? `${base}/api/auth/yandex/link/start` : "/api/auth/yandex/link/start";
  }, []);

  const isProviderLinked = useCallback(
    (providerName: string) =>
      identities.some((identity) => {
        const provider = identity.provider ?? identity.type ?? identity.name ?? "";
        return provider.toString().toLowerCase() === providerName;
      }),
    [identities],
  );

  const githubLinked = useMemo(() => isProviderLinked("github"), [isProviderLinked]);
  const yandexLinked = useMemo(() => isProviderLinked("yandex"), [isProviderLinked]);
  const telegramLinked = useMemo(
    () => isProviderLinked("telegram"),
    [isProviderLinked],
  );

  const refreshIdentities = useCallback(async () => {
    if (status !== "authed") {
      setIdentities([]);
      return;
    }

    setIsIdentitiesLoading(true);
    setIdentityError(null);
    try {
      const list = await authApi.getIdentities();
      setIdentities(list);
    } catch (err: any) {
      const statusCode = err?.response?.status ?? err?.normalized?.status;
      if (statusCode && statusCode !== 404) {
        setIdentityError(
          err?.response?.data?.message ??
            err?.normalized?.message ??
            "Не удалось обновить список подключений.",
        );
      }
      setIdentities([]);
    } finally {
      setIsIdentitiesLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authed") return;
    void refreshIdentities();
  }, [refreshIdentities, status]);

  useOauthRedirect({
    onResultOk: refreshAuth,
    onResultLinked: refreshIdentities,
    providerFallback: "соцсеть",
  });

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

  const handleNameEditStart = () => {
    setIsNameEditing(true);
    setNameDraft(editableName);
    setNameError(null);
    setNameSuccess(null);
  };

  const handleNameEditCancel = () => {
    setIsNameEditing(false);
    setNameDraft(editableName);
    setNameError(null);
  };

  const handleNameSave = async () => {
    const nextName = nameDraft.trim();
    if (!nextName) {
      setNameError("Введите имя профиля.");
      return;
    }
    setIsNameSaving(true);
    setNameError(null);
    setNameSuccess(null);
    try {
      await authApi.updateProfileName({ displayName: nextName });
      await refreshAuth();
      setNameSuccess("Имя сохранено.");
      setIsNameEditing(false);
    } catch (err: any) {
      setNameError(
        err?.response?.data?.message ??
          err?.normalized?.message ??
          "Не удалось сохранить имя.",
      );
    } finally {
      setIsNameSaving(false);
    }
  };

  const handleAvatarPick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Нужен файл изображения.");
      setAvatarSuccess(null);
      return;
    }

    setIsAvatarUploading(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      const presigned = await authApi.presignProfileAvatarUpload({
        contentType: file.type,
        sizeBytes: file.size,
      });
      await authApi.uploadProfileAvatarByPresignedUrl(
        presigned.upload_url,
        file,
        presigned.headers ?? {},
      );
      await authApi.confirmProfileAvatarUpload(presigned.object_key);
      await refreshAuth();
      setAvatarSuccess("Фото профиля обновлено.");
    } catch (err: any) {
      setAvatarError(
        err?.response?.data?.message ??
          err?.normalized?.message ??
          err?.message ??
          "Не удалось обновить фото профиля.",
      );
    } finally {
      setIsAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
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
                  <div className={classes.avatarWrap}>
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
                    <ActionIcon
                      size={34}
                      radius="xl"
                      className={classes.avatarPlusButton}
                      aria-label="Изменить фото профиля"
                      onClick={handleAvatarPick}
                      loading={isAvatarUploading}
                    >
                      <IconPlus size={16} />
                    </ActionIcon>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      hidden
                      onChange={(event) => {
                        void handleAvatarSelected(event.currentTarget.files?.[0] ?? null);
                      }}
                    />
                  </div>
                  <div className={classes.heroText}>
                    <div className={classes.heroNameRow}>
                      <Title order={2}>{profile.name}</Title>
                      <ActionIcon
                        size={34}
                        variant="transparent"
                        className={`${classes.iconButton} glass-action glass-action--square`}
                        aria-label="Редактировать имя"
                        onClick={handleNameEditStart}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </div>
                    {isNameEditing && (
                      <div className={classes.nameEditBox}>
                        <TextInput
                          value={nameDraft}
                          placeholder="Введите имя"
                          onChange={(event) => {
                            setNameDraft(event.currentTarget.value);
                            setNameError(null);
                            setNameSuccess(null);
                          }}
                          disabled={isNameSaving}
                        />
                        <div className={classes.nameEditActions}>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={handleNameSave}
                            loading={isNameSaving}
                          >
                            Сохранить
                          </Button>
                          <ActionIcon
                            variant="light"
                            color="gray"
                            aria-label="Отмена"
                            onClick={handleNameEditCancel}
                            disabled={isNameSaving}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </div>
                      </div>
                    )}
                    {nameError && <Text className={classes.errorText}>{nameError}</Text>}
                    {nameSuccess && <Text className={classes.successText}>{nameSuccess}</Text>}
                    {avatarError && <Text className={classes.errorText}>{avatarError}</Text>}
                    {avatarSuccess && <Text className={classes.successText}>{avatarSuccess}</Text>}
                    <Text className={classes.heroCaption}>
                      Здесь будет история, избранные места и персональные настройки.
                    </Text>
                  </div>
                </div>

                <div className={classes.listCard}>
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
                        <span className={classes.verifiedBadge} aria-label="Email подтверждён">
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

          {user && (
            <section className={classes.sectionCard}>
              <div className={classes.sectionHeader}>
                <Group gap="xs">
                  <IconLink size={18} />
                  <Text fw={600}>Соцсети</Text>
                </Group>
                {isIdentitiesLoading && (
                  <Text size="sm" className={classes.sectionAction}>
                    Обновляем...
                  </Text>
                )}
              </div>

              <div className={classes.socialList}>
                <div className={classes.socialRow}>
                  <div className={classes.socialMeta}>
                    <IconBrandGithub size={18} />
                    <div>
                      <Text fw={600}>GitHub</Text>
                      <span
                        className={classes.statusPill}
                        data-status={githubLinked ? "ok" : "warn"}
                      >
                        {githubLinked ? <IconCircleCheck size={14} /> : <IconCircleX size={14} />}
                        {githubLinked ? "подключён" : "не подключён"}
                      </span>
                    </div>
                  </div>
                  {!githubLinked && (
                    <div className={classes.socialActions}>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => window.location.assign(githubAuthUrl)}
                        disabled={isIdentitiesLoading}
                      >
                        Подключить
                      </Button>
                    </div>
                  )}
                </div>

                <div className={classes.socialRow}>
                  <div className={classes.socialMeta}>
                    <IconBrandYandex size={18} />
                    <div>
                      <Text fw={600}>Яндекс</Text>
                      <span
                        className={classes.statusPill}
                        data-status={yandexLinked ? "ok" : "warn"}
                      >
                        {yandexLinked ? <IconCircleCheck size={14} /> : <IconCircleX size={14} />}
                        {yandexLinked ? "подключён" : "не подключён"}
                      </span>
                    </div>
                  </div>
                  {!yandexLinked && (
                    <div className={classes.socialActions}>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => window.location.assign(yandexAuthUrl)}
                        disabled={isIdentitiesLoading}
                      >
                        Подключить
                      </Button>
                    </div>
                  )}
                </div>

                <div className={classes.socialRow}>
                  <div className={classes.socialMeta}>
                    <IconBrandTelegram size={18} />
                    <div>
                      <Text fw={600}>Telegram</Text>
                      <span
                        className={classes.statusPill}
                        data-status={telegramLinked ? "ok" : "warn"}
                      >
                        {telegramLinked ? <IconCircleCheck size={14} /> : <IconCircleX size={14} />}
                        {telegramLinked ? "подключён" : "не подключён"}
                      </span>
                    </div>
                  </div>
                  {!telegramLinked && (
                    <div className={classes.socialActions}>
                      <TelegramLoginWidget flow="link" size="medium" />
                    </div>
                  )}
                </div>
              </div>

              {identityError && <Text className={classes.errorText}>{identityError}</Text>}
            </section>
          )}

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
