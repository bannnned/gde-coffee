import {
  IconArrowLeft,
  IconHeart,
  IconHeartFilled,
  IconLogout,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import { useLocation, useNavigate, type Location as RouterLocation } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import { Badge, Button } from "../components/ui";
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
    avatarInputRef,
    isLoggingOut,
    isAvatarUploading,
    avatarError,
    avatarSuccess,
    reputationProfile,
    isReputationLoading,
    reputationError,
    handleLogout,
    handleAvatarPick,
    handleAvatarSelected,
  } = useProfileAccount({
    user,
    status,
    refreshAuth,
    logout,
  });

  const levelLabel = reputationProfile?.levelLabel || user?.reputationBadge || "Участник";
  const levelNumber = reputationProfile?.level ?? 1;
  const levelProgress = Math.max(
    0,
    Math.min(100, Math.round((reputationProfile?.levelProgress ?? 0) * 100)),
  );
  const levelPointsToNext = Math.max(0, Math.round(reputationProfile?.pointsToNextLevel ?? 0));
  const levelScore = Math.round(reputationProfile?.score ?? 0);
  const levelEventsCount = reputationProfile?.eventsCount ?? 0;
  const isFavoritesContext = backgroundLocation?.pathname?.startsWith("/favorites") ?? false;

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
          <section className="grid gap-4">
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
                      <h2 className="text-[clamp(1.5rem,4.8vw,2rem)] font-semibold leading-[1.05] text-[var(--text)]">
                        {profile.name}
                      </h2>
                    </div>
                    {avatarError ? <p className="text-sm text-danger">{avatarError}</p> : null}
                    {avatarSuccess ? (
                      <p className="text-sm text-[var(--color-status-success)]">{avatarSuccess}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
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
                  <div
                    className="relative h-3 overflow-hidden rounded-full border"
                    style={{
                      borderColor: "color-mix(in srgb, var(--color-brand-accent) 28%, var(--border))",
                      background:
                        "linear-gradient(90deg, color-mix(in srgb, var(--surface) 84%, transparent), color-mix(in srgb, var(--glass-grad-1) 70%, transparent))",
                      boxShadow: "inset 0 1px 2px color-mix(in srgb, #000 20%, transparent)",
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${levelProgress}%`,
                        background:
                          "linear-gradient(90deg, color-mix(in srgb, var(--color-brand-accent) 92%, white 8%), var(--color-brand-accent-strong))",
                        boxShadow:
                          "0 0 0 1px color-mix(in srgb, var(--color-brand-accent) 36%, transparent), 0 6px 16px color-mix(in srgb, var(--color-brand-accent-soft) 44%, transparent)",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(180deg, color-mix(in srgb, #fff 24%, transparent), transparent 60%)",
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

              </div>
            )}
          </section>

          {user ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void handleLogout(() => {
                  void navigate("/", { replace: true });
                })
              }
              disabled={isLoggingOut}
              className="h-11 rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, #B93030, #8E2222)",
                color: "white",
                border: "1px solid color-mix(in srgb, #7F1E1E 58%, #000 42%)",
                boxShadow: "0 12px 24px color-mix(in srgb, #8E2222 36%, transparent)",
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
