import { useLayoutEffect, useMemo, useRef } from "react";
import { IconHeart, IconHeartFilled, IconLogin } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../components/AuthGate";
import { DISCOVERY_ICONS, DISCOVERY_UI_TEXT } from "../constants";
import classes from "./FiltersBar.module.css";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";
import { resolveAvatarUrl } from "../../../utils/resolveAvatarUrl";

type FiltersBarProps = {
  topTags?: string[];
  topTagsSource?: string;
  topTagsLoading?: boolean;
  favoritesOnly?: boolean;
  onToggleFavorites?: () => void;
  canToggleFavorites?: boolean;
  onOpenSettings: () => void;
  showFetchingBadge: boolean;
  highlightSettingsButton?: boolean;
  suppressClicksUntil?: number;
};

export default function FiltersBar({
  topTags: _topTags = [],
  topTagsSource: _topTagsSource = "city_popular",
  topTagsLoading: _topTagsLoading = false,
  favoritesOnly = false,
  onToggleFavorites,
  canToggleFavorites = false,
  onOpenSettings,
  showFetchingBadge: _showFetchingBadge,
  highlightSettingsButton = false,
  suppressClicksUntil = 0,
}: FiltersBarProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const { setFiltersBarHeight } = useLayoutMetrics();
  const { user, status, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarUrl = useMemo(() => resolveAvatarUrl(user?.avatarUrl), [user]);
  const userLabel = useMemo(() => {
    const value =
      user?.displayName?.trim() ||
      user?.name?.trim() ||
      user?.email?.trim() ||
      user?.id?.trim() ||
      "";
    return value;
  }, [user]);

  useLayoutEffect(() => {
    const node = headerRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      setFiltersBarHeight(rect.bottom);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("focus", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("focus", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      setFiltersBarHeight(0);
    };
  }, [setFiltersBarHeight]);

  const isClickSuppressed = Date.now() < suppressClicksUntil;

  return (
    <div
      className={classes.root}
      data-ui="filters-bar"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
      }}
    >
      <div
        className={classes.headerMain}
        data-ui="filters-bar-header"
        ref={headerRef}
      >
        {user ? (
          <button
            className={`${classes.userBadge} ui-focus-ring`}
            aria-label="Open profile"
            type="button"
            onClick={() => {
              if (isClickSuppressed) return;
              const overlayBackgroundLocation = {
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
                state: null,
                key: location.key,
              };
              void navigate("/profile", {
                state: { backgroundLocation: overlayBackgroundLocation },
              });
            }}
            title={userLabel}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userLabel || "User"}
                className={classes.userAvatar}
                loading="lazy"
              />
            ) : (
              <span style={{ fontWeight: 700 }}>
                {(userLabel || "?")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
          </button>
        ) : (
          <button
            className={`${classes.userBadge} ui-focus-ring`}
            aria-label="Войти"
            type="button"
            onClick={() => {
              if (isClickSuppressed) return;
              if (status === "loading") return;
              openAuthModal("login");
            }}
          >
            <IconLogin size={17} />
          </button>
        )}

        <div className={classes.actionsRow}>
          {canToggleFavorites && (
            <button
              type="button"
              className={`glass-action glass-action--square ui-focus-ring ${favoritesOnly ? classes.favoriteHeaderButtonActive : ""}`}
              aria-label="Избранные кофейни"
              onClick={() => {
                if (isClickSuppressed) return;
                onToggleFavorites?.();
              }}
            >
              {favoritesOnly ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
            </button>
          )}
          <button
            type="button"
            className={`glass-action glass-action--square ui-focus-ring ${highlightSettingsButton ? classes.attentionButton : ""}`}
            aria-label={DISCOVERY_UI_TEXT.settingsAria}
            onClick={() => {
              if (isClickSuppressed) return;
              onOpenSettings();
            }}
          >
            <DISCOVERY_ICONS.settings size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
