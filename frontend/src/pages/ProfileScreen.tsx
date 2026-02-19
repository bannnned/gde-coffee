import {
  ActionIcon,
  Badge,
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
  IconCheck,
  IconChecklist,
  IconCrown,
  IconHeart,
  IconId,
  IconLink,
  IconLinkOff,
  IconLogout,
  IconMail,
  IconPlus,
  IconPencil,
  IconSettings,
  IconTrophy,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import TelegramLoginWidget from "../components/TelegramLoginWidget";
import useProfileAccount from "../features/profile/model/useProfileAccount";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import classes from "./ProfileScreen.module.css";

export default function ProfileScreen() {
  const { user, logout, openAuthModal, status, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundLocation = (
    location.state as { backgroundLocation?: RouterLocation } | null
  )?.backgroundLocation;

  useAllowBodyScroll();
  const {
    profile,
    githubAuthUrl,
    yandexAuthUrl,
    githubLinked,
    yandexLinked,
    telegramLinked,
    socialStatuses,
    avatarInputRef,
    isLoggingOut,
    isIdentitiesLoading,
    identityError,
    nameDraft,
    isNameEditing,
    isNameSaving,
    nameError,
    nameSuccess,
    isAvatarUploading,
    avatarError,
    avatarSuccess,
    setNameDraft,
    setNameError,
    setNameSuccess,
    handleLogout,
    handleNameEditStart,
    handleNameEditCancel,
    handleNameSave,
    handleAvatarPick,
    handleAvatarSelected,
  } = useProfileAccount({
    user,
    status,
    refreshAuth,
    logout,
  });

  return (
    <Box className={classes.screen} data-ui="profile-screen">
      <Container className={classes.container}>
        <header className={classes.header}>
          <ActionIcon
            size={42}
            variant="transparent"
            className={`${classes.iconButton} glass-action glass-action--square`}
            onClick={() => {
              if (backgroundLocation) {
                navigate(-1);
                return;
              }
              void navigate("/");
            }}
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
            onClick={() => {
              if (backgroundLocation) {
                void navigate("/settings", {
                  state: { backgroundLocation },
                });
                return;
              }
              void navigate("/settings");
            }}
            aria-label="Настройки"
          >
            <IconSettings size={18} />
          </ActionIcon>
        </header>

        <Stack gap="lg">
          <Paper className={classes.profileCard} radius={22}>
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
                      size={32}
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
                      {isNameEditing ? (
                        <>
                          <TextInput
                            value={nameDraft}
                            placeholder="Введите имя"
                            autoFocus
                            className={classes.nameInlineInput}
                            onChange={(event) => {
                              setNameDraft(event.currentTarget.value);
                              setNameError(null);
                              setNameSuccess(null);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleNameSave();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                handleNameEditCancel();
                              }
                            }}
                            disabled={isNameSaving}
                          />
                          <ActionIcon
                            size={28}
                            radius="xl"
                            variant="subtle"
                            aria-label="Сохранить имя"
                            onClick={() => {
                              void handleNameSave();
                            }}
                            loading={isNameSaving}
                            className={classes.nameInlineAction}
                          >
                            <IconCheck size={15} />
                          </ActionIcon>
                          <ActionIcon
                            size={28}
                            radius="xl"
                            variant="subtle"
                            aria-label="Отмена"
                            onClick={handleNameEditCancel}
                            disabled={isNameSaving}
                            className={classes.nameInlineAction}
                          >
                            <IconX size={15} />
                          </ActionIcon>
                        </>
                      ) : (
                        <>
                          <Title order={2} className={classes.heroNameTitle}>
                            {profile.name}
                          </Title>
                          <button
                            type="button"
                            className={classes.inlineEditIcon}
                            aria-label="Редактировать имя"
                            onClick={handleNameEditStart}
                          >
                            <IconPencil size={16} />
                          </button>
                        </>
                      )}
                    </div>
                    {nameError && <Text className={classes.errorText}>{nameError}</Text>}
                    {nameSuccess && <Text className={classes.successText}>{nameSuccess}</Text>}
                    {avatarError && <Text className={classes.errorText}>{avatarError}</Text>}
                    {avatarSuccess && <Text className={classes.successText}>{avatarSuccess}</Text>}
                    <Text className={classes.heroCaption}>
                      Здесь будет история, избранные места и персональные настройки.
                    </Text>
                    <Group gap={8} justify="center">
                      <Badge variant="light">
                        {user.reputationBadge ?? "Участник"}
                      </Badge>
                      {user.trustedParticipant && (
                        <Badge color="blue" variant="light">
                          Доверенный участник
                        </Badge>
                      )}
                    </Group>
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
                  <IconHeart size={18} />
                  <Text fw={600}>Избранные кофейни</Text>
                </Group>
              </div>
              <Button
                variant="light"
                onClick={() => void navigate("/favorites")}
              >
                Открыть избранное
              </Button>
            </section>
          )}

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

              <div className={classes.socialCompact}>
                <div className={classes.socialIconRow}>
                  {socialStatuses.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className={`${classes.socialIconItem} ${
                          item.linked ? classes.socialIconItemOk : classes.socialIconItemWarn
                        }`}
                        title={`${item.label}: ${item.linked ? "подключен" : "не подключен"}`}
                        aria-label={`${item.label}: ${item.linked ? "подключен" : "не подключен"}`}
                      >
                        <ItemIcon size={18} />
                        <span
                          className={classes.socialIconBadge}
                          data-status={item.linked ? "ok" : "warn"}
                        >
                          {item.linked ? <IconCheck size={10} /> : <IconLinkOff size={10} />}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className={classes.socialConnectList}>
                  {!githubLinked && (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => window.location.assign(githubAuthUrl)}
                      disabled={isIdentitiesLoading}
                    >
                      Подключить GitHub
                    </Button>
                  )}

                  {!yandexLinked && (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => window.location.assign(yandexAuthUrl)}
                      disabled={isIdentitiesLoading}
                    >
                      Подключить Яндекс
                    </Button>
                  )}

                  {!telegramLinked && (
                    <div className={classes.socialTelegramConnect}>
                      <TelegramLoginWidget flow="link" size="medium" />
                    </div>
                  )}

                  {githubLinked && yandexLinked && telegramLinked && (
                    <Text size="sm" className={classes.muted}>
                      Все соцсети подключены.
                    </Text>
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
              onClick={() =>
                void handleLogout(() => {
                  void navigate("/", { replace: true });
                })
              }
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
