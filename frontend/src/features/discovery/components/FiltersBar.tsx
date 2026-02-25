import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Text,
  UnstyledButton,
} from "@mantine/core";
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
};

export default function FiltersBar({
  topTags = [],
  topTagsSource = "city_popular",
  topTagsLoading = false,
  favoritesOnly = false,
  onToggleFavorites,
  canToggleFavorites = false,
  onOpenSettings,
  showFetchingBadge,
  highlightSettingsButton = false,
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
  const hasTopTags = topTags.length > 0;

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

  return (
    <Box
      pos="absolute"
      top={0}
      left={0}
      right={0}
      className={classes.root}
      data-ui="filters-bar"
    >
      <div
        className={classes.headerShell}
        data-ui="filters-bar-header"
        ref={headerRef}
      >
        <div className={classes.headerMain}>
          {user ? (
            <UnstyledButton
              className={`${classes.userBadge} ui-focus-ring`}
              aria-label="Open profile"
              type="button"
              onClick={() => {
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
                <Text fw={700}>
                  {(userLabel || "?")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              )}
            </UnstyledButton>
          ) : (
            <Button
              size="sm"
              radius="lg"
              variant="filled"
              className={`${classes.loginButton} ui-focus-ring`}
              leftSection={<IconLogin size={16} />}
              onClick={() => openAuthModal("login")}
              disabled={status === "loading"}
            >
              Войти
            </Button>
          )}

          <div className={classes.actionsRow}>
            {canToggleFavorites && (
              <ActionIcon
                variant="transparent"
                size={42}
                className={`glass-action glass-action--square ${
                  favoritesOnly ? classes.favoriteHeaderButtonActive : ""
                }`}
                aria-label="Избранные кофейни"
                onClick={onToggleFavorites}
              >
                {favoritesOnly ? <IconHeartFilled size={18} /> : <IconHeart size={18} />}
              </ActionIcon>
            )}
            <ActionIcon
              variant="transparent"
              size={42}
              className={`glass-action glass-action--square ${
                highlightSettingsButton ? classes.attentionButton : ""
              }`}
              aria-label={DISCOVERY_UI_TEXT.settingsAria}
              onClick={onOpenSettings}
            >
              <DISCOVERY_ICONS.settings size={18} />
            </ActionIcon>
          </div>
        </div>

        {(topTagsLoading || hasTopTags) && (
          <div className={classes.topTagsRow} data-source={topTagsSource}>
            <div className={classes.topTagsScroller}>
              {topTagsLoading && !hasTopTags ? (
                <span className={classes.topTagSkeleton} />
              ) : (
                topTags.map((tag) => (
                  <span key={tag} className={classes.topTagChip}>
                    {tag}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showFetchingBadge && (
        <div className={classes.fetchRow}>
          <Badge
            className={classes.fetchBadge}
            variant="filled"
            styles={{
              root: {
                backdropFilter: "blur(10px)",
                background: "var(--accent)",
                color: "var(--color-on-accent)",
                border: "1px solid var(--accent)",
              },
            }}
          >
            {DISCOVERY_UI_TEXT.fetching}
          </Badge>
        </div>
      )}
    </Box>
  );
}
