import { useState } from "react";
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconEyeOff,
  IconHeart,
  IconHeartFilled,
  IconLinkOff,
  IconLogout,
  IconPencil,
  IconPlus,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import TelegramLoginWidget from "../components/TelegramLoginWidget";
import { Badge, Button, Input } from "../components/ui";
import useProfileAccount from "../features/profile/model/useProfileAccount";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { cn } from "../lib/utils";

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
    reputationProfile,
    isReputationLoading,
    reputationError,
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

  const inlineNameWidthCh = Math.max(
    10,
    Math.min(28, ((nameDraft || profile.name || "").trim().length || 8) + 1),
  );
  const levelLabel = reputationProfile?.levelLabel || user?.reputationBadge || "Участник";
  const levelNumber = reputationProfile?.level ?? 1;
  const levelProgress = Math.max(
    0,
    Math.min(100, Math.round((reputationProfile?.levelProgress ?? 0) * 100)),
  );
  const levelPointsToNext = Math.max(0, Math.round(reputationProfile?.pointsToNextLevel ?? 0));
  const levelScore = Math.round(reputationProfile?.score ?? 0);
  const levelEventsCount = reputationProfile?.eventsCount ?? 0;
  const [showProfileData, setShowProfileData] = useState(false);
  const isFavoritesContext = backgroundLocation?.pathname?.startsWith("/favorites") ?? false;

  const surfaceGlassStyle = {
    background: "linear-gradient(145deg, var(--glass-grad-1), var(--glass-grad-2))",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--glass-shadow)",
    backdropFilter: "blur(12px) saturate(145%)",
    WebkitBackdropFilter: "blur(12px) saturate(145%)",
  } as const;

  return (
    <div
      data-ui="profile-screen"
      className="min-h-[100dvh] overflow-y-auto px-[var(--page-edge-padding)]"
      style={{
        paddingTop: "calc(var(--page-edge-padding) + var(--safe-top))",
        paddingBottom: "calc(var(--page-edge-padding) + var(--safe-bottom))",
        background:
          "radial-gradient(circle at top left, var(--bg-accent-1), transparent 45%), radial-gradient(circle at 80% 20%, var(--bg-accent-2), transparent 40%), var(--bg)",
      }}
    >
      <div className="mx-auto w-full max-w-[680px]">
        <header className="relative mb-5 flex min-h-[42px] items-center justify-between gap-2.5">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="glass-action glass-action--square"
            onClick={() => {
              if (backgroundLocation) {
                void navigate(-1);
                return;
              }
              void navigate("/");
            }}
            aria-label="Назад"
          >
            <IconArrowLeft size={18} />
          </Button>
          <p className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-[var(--muted)]">
            Профиль
          </p>
          <div className="inline-flex items-center gap-2">
            {user ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className={cn(
                  "glass-action glass-action--square",
                  isFavoritesContext && "glass-action--active",
                )}
                onClick={() => {
                  void navigate("/favorites");
                }}
                aria-label="Избранные кофейни"
              >
                {isFavoritesContext ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="glass-action glass-action--square"
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
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          <section
            className="grid gap-4 rounded-[24px] p-5 sm:p-7"
            style={{
              background: "linear-gradient(150deg, var(--glass-grad-hover-1), var(--glass-grad-hover-2))",
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
              backdropFilter: "blur(14px) saturate(150%)",
              WebkitBackdropFilter: "blur(14px) saturate(150%)",
            }}
          >
            {status === "loading" ? (
              <p className="text-sm text-[var(--muted)]">Загружаем профиль...</p>
            ) : !user ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className="inline-flex h-[120px] w-[120px] items-center justify-center rounded-full border-4 text-[2.2rem] font-bold"
                  style={{
                    color: "var(--text)",
                    borderColor: "var(--glass-border)",
                    background:
                      "radial-gradient(circle at 30% 30%, var(--glass-grad-hover-1), var(--surface)), linear-gradient(135deg, var(--accent), var(--glass-grad-hover-1))",
                    boxShadow: "var(--shadow)",
                  }}
                >
                  ?
                </div>
                <h2 className="text-[1.6rem] font-semibold leading-tight text-[var(--text)]">
                  Профиль недоступен
                </h2>
                <p className="max-w-[340px] text-sm text-[var(--muted)]">
                  Войдите, чтобы увидеть данные аккаунта и управлять профилем.
                </p>
                <Button type="button" onClick={() => openAuthModal("login")}>
                  Войти
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid place-items-center gap-2.5 text-center">
                  <div className="relative inline-block h-[120px] w-[120px] leading-none">
                    <div
                      className="relative inline-flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-4 text-[2.2rem] font-bold"
                      style={{
                        color: "var(--text)",
                        borderColor: "var(--glass-border)",
                        background:
                          "radial-gradient(circle at 30% 30%, var(--glass-grad-hover-1), var(--surface)), linear-gradient(135deg, var(--accent), var(--glass-grad-hover-1))",
                        boxShadow: "var(--shadow)",
                      }}
                    >
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt={profile.name}
                          className="h-full w-full rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        profile.initial
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute right-0 top-0 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-full border text-[var(--text)] ui-focus-ring ui-interactive"
                      style={{
                        borderColor: "var(--glass-border)",
                        background:
                          "linear-gradient(135deg, var(--glass-grad-hover-1), var(--glass-grad-hover-2))",
                        boxShadow: "var(--shadow)",
                      }}
                      aria-label="Изменить фото профиля"
                      onClick={handleAvatarPick}
                      disabled={isAvatarUploading}
                    >
                      {isAvatarUploading ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <IconPlus size={16} />
                      )}
                    </button>
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

                  <div className="grid gap-2">
                    <div className="flex min-h-10 items-center justify-center gap-2">
                      {isNameEditing ? (
                        <>
                          <Input
                            type="text"
                            value={nameDraft}
                            placeholder="Введите имя"
                            autoFocus
                            aria-label="Имя профиля"
                            style={{
                              width: `${inlineNameWidthCh}ch`,
                              minWidth: "10ch",
                              maxWidth: "min(74vw, 320px)",
                              border: "none",
                              borderBottom:
                                "2px solid color-mix(in srgb, var(--accent) 46%, transparent)",
                              outline: "none",
                              borderRadius: 0,
                              background: "transparent",
                              boxShadow: "none",
                              color: "var(--text)",
                              fontFamily: "var(--font-display)",
                              fontSize: "clamp(1.5rem, 4.8vw, 2rem)",
                              fontWeight: 600,
                              lineHeight: 1.05,
                              letterSpacing: "0.01em",
                              textAlign: "center",
                              padding: "0 2px 2px",
                              height: "auto",
                            }}
                            onChange={(event) => {
                              setNameDraft(event.currentTarget.value);
                              setNameError(null);
                              setNameSuccess(null);
                            }}
                            onFocus={(event) => {
                              event.currentTarget.select();
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
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Сохранить имя"
                            onClick={() => {
                              void handleNameSave();
                            }}
                            disabled={isNameSaving}
                            className="h-7 w-7 rounded-full text-[var(--text)]"
                          >
                            {isNameSaving ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <IconCheck size={15} />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label="Отмена"
                            onClick={handleNameEditCancel}
                            disabled={isNameSaving}
                            className="h-7 w-7 rounded-full text-[var(--text)]"
                          >
                            <IconX size={15} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <h2 className="text-[clamp(1.5rem,4.8vw,2rem)] font-semibold leading-[1.05] text-[var(--text)]">
                            {profile.name}
                          </h2>
                          <button
                            type="button"
                            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-transparent text-[var(--muted)] ui-focus-ring ui-interactive hover:bg-[color:color-mix(in_srgb,var(--surface)_70%,transparent)] hover:text-[var(--text)]"
                            aria-label="Редактировать имя"
                            onClick={handleNameEditStart}
                          >
                            <IconPencil size={24} />
                          </button>
                        </>
                      )}
                    </div>

                    {nameError ? <p className="text-sm text-danger">{nameError}</p> : null}
                    {nameSuccess ? (
                      <p className="text-sm text-[var(--color-status-success)]">{nameSuccess}</p>
                    ) : null}
                    {avatarError ? <p className="text-sm text-danger">{avatarError}</p> : null}
                    {avatarSuccess ? (
                      <p className="text-sm text-[var(--color-status-success)]">{avatarSuccess}</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[20px] border border-[var(--glass-border)] bg-[linear-gradient(145deg,var(--glass-grad-1),var(--glass-grad-2))] p-4 shadow-[var(--glass-shadow)]">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-[var(--text)]">
                        Lv. {levelNumber} - {levelLabel}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        Очки: {levelScore} · событий: {levelEventsCount}
                      </p>
                    </div>
                    {isReputationLoading ? (
                      <p className="text-sm text-[var(--muted)]">Обновляем...</p>
                    ) : null}
                  </div>
                  <div className="h-2 rounded-full bg-[color:color-mix(in_srgb,var(--surface)_80%,transparent)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${levelProgress}%`,
                        background:
                          "linear-gradient(90deg, var(--color-brand-accent), var(--color-brand-accent-strong))",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-[var(--text)]">
                    Прогресс: {levelProgress}%
                    {levelPointsToNext > 0
                      ? ` · до следующего уровня ${levelPointsToNext}`
                      : " · максимальный уровень"}
                  </p>
                  {reputationError ? <p className="mt-1 text-sm text-danger">{reputationError}</p> : null}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className={cn(
                    "w-full justify-between rounded-full",
                    showProfileData && "border-[var(--color-brand-accent)]",
                  )}
                  onClick={() => setShowProfileData((prev) => !prev)}
                >
                  <span className="inline-flex items-center gap-2">
                    {showProfileData ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    {showProfileData ? "Скрыть данные" : "Показать данные"}
                  </span>
                  {showProfileData ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                </Button>

                {showProfileData ? (
                  <div className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex min-h-[54px] items-center gap-3.5 border-b border-[var(--border)] px-4 py-3">
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <p className="text-xs text-[var(--muted)]">Email</p>
                        <p className="break-all text-sm font-semibold text-[var(--text)]">{profile.email}</p>
                      </div>
                      {profile.isVerified ? (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border"
                          style={{
                            background: "var(--color-status-success)",
                            color: "var(--color-on-accent)",
                            borderColor: "var(--color-status-success)",
                          }}
                          aria-label="Email подтверждён"
                        >
                          <IconCheck size={12} />
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-h-[54px] items-center gap-3.5 px-4 py-3">
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <p className="text-xs text-[var(--muted)]">ID аккаунта</p>
                        <p className="break-all text-sm font-semibold text-[var(--text)]">{profile.id}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {user ? (
            <section className="grid gap-4 rounded-[24px] p-4 sm:p-6" style={surfaceGlassStyle}>
              <div className="flex items-center justify-between gap-3.5">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-[var(--text)]">Соцсети</p>
                </div>
                {isIdentitiesLoading ? (
                  <p className="text-sm text-[var(--muted)]">Обновляем...</p>
                ) : null}
              </div>

              <div className="grid gap-3.5">
                <div className="flex items-center gap-2.5">
                  {socialStatuses.map((item) => {
                    const ItemIcon = item.icon;
                    const linked = item.linked;
                    return (
                      <div
                        key={item.id}
                        className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border shadow-[var(--shadow)]"
                        style={{
                          borderColor: linked
                            ? "color-mix(in srgb, var(--color-status-success) 45%, var(--border))"
                            : "color-mix(in srgb, var(--color-status-error) 45%, var(--border))",
                          color: linked
                            ? "var(--color-status-success)"
                            : "var(--color-status-error)",
                          background:
                            "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
                        }}
                        title={`${item.label}: ${linked ? "подключен" : "не подключен"}`}
                        aria-label={`${item.label}: ${linked ? "подключен" : "не подключен"}`}
                      >
                        <ItemIcon size={18} />
                        <span
                          className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--surface)]"
                          style={{
                            color: "var(--color-on-accent)",
                            background: linked
                              ? "var(--color-status-success)"
                              : "var(--color-status-error)",
                          }}
                        >
                          {linked ? <IconCheck size={10} /> : <IconLinkOff size={10} />}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {!githubLinked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => window.location.assign(githubAuthUrl)}
                      disabled={isIdentitiesLoading}
                    >
                      Подключить GitHub
                    </Button>
                  ) : null}

                  {!yandexLinked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => window.location.assign(yandexAuthUrl)}
                      disabled={isIdentitiesLoading}
                    >
                      Подключить Яндекс
                    </Button>
                  ) : null}

                  {!telegramLinked ? (
                    <div className="inline-flex">
                      <TelegramLoginWidget flow="link" size="medium" />
                    </div>
                  ) : null}

                  {githubLinked && yandexLinked && telegramLinked ? (
                    <p className="text-sm text-[var(--muted)]">Все соцсети подключены.</p>
                  ) : null}
                </div>
              </div>

              {identityError ? <p className="text-sm text-danger">{identityError}</p> : null}
            </section>
          ) : null}

          {user ? (
            <Button
              type="button"
              onClick={() =>
                void handleLogout(() => {
                  void navigate("/", { replace: true });
                })
              }
              disabled={isLoggingOut}
              className="h-11 rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-status-error), color-mix(in srgb, var(--color-status-error) 60%, var(--color-brand-warning)))",
                color: "white",
              }}
            >
              {isLoggingOut ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Выходим...
                </>
              ) : (
                <>
                  <IconLogout size={16} />
                  Выйти
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
