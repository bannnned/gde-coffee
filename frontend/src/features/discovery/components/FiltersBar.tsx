import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Chip,
  Group,
  Text,
  UnstyledButton,
  useMantineTheme,
} from "@mantine/core";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { IconHeart, IconHeartFilled, IconLogin } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../components/AuthGate";
import type { Amenity } from "../../../entities/cafe/model/types";
import { AMENITY_LABELS, DISCOVERY_ICONS, DISCOVERY_UI_TEXT } from "../constants";
import classes from "./FiltersBar.module.css";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";
import { resolveAvatarUrl } from "../../../utils/resolveAvatarUrl";
import {
  createDiscoveryAmenityChipLabelStyles,
} from "../ui/styles/glass";

type FiltersBarProps = {
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
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

const CHIP_GAP_PX = 4;

export default function FiltersBar({
  selectedAmenities,
  onChangeAmenities,
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
  const theme = useMantineTheme();
  const chipsScrollerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const chipMeasureRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const allAmenities = useMemo(
    () => Object.keys(AMENITY_LABELS) as Amenity[],
    [],
  );
  const [visibleAmenities, setVisibleAmenities] =
    useState<Amenity[]>(allAmenities);
  const selectedKey = useMemo(
    () => selectedAmenities.slice().sort().join(","),
    [selectedAmenities],
  );
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

  const amenityChipLabelStyles = createDiscoveryAmenityChipLabelStyles(theme.fontSizes.xs);
  const hasTopTags = topTags.length > 0;

  useLayoutEffect(() => {
    const container = chipsScrollerRef.current;
    if (!container) return;
    let raf = 0;

    const update = () => {
      const available = container.clientWidth;
      if (available <= 0) return;
      let used = 0;
      const next: Amenity[] = [];

      for (const amenity of allAmenities) {
        const node = chipMeasureRefs.current[amenity];
        if (!node) continue;
        const width = node.offsetWidth;
        const nextUsed = next.length === 0 ? width : used + CHIP_GAP_PX + width;

        if (nextUsed <= available) {
          next.push(amenity);
          used = nextUsed;
        } else {
          break;
        }
      }

      setVisibleAmenities((prev) => {
        if (
          prev.length === next.length &&
          prev.every((v, i) => v === next[i])
        ) {
          return prev;
        }
        return next;
      });
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [allAmenities, selectedKey, theme.fontSizes.xs]);

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
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
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
      px="sm"
      pb="sm"
      pt="calc(env(safe-area-inset-top) + var(--mantine-spacing-sm))"
      className={classes.root}
      data-ui="filters-bar"
    >
      <Group
        justify="space-between"
        className={classes.header}
        data-ui="filters-bar-header"
        ref={headerRef}
      >
        {user ? (
          <UnstyledButton
            className={classes.userBadge}
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
            className={classes.loginButton}
            leftSection={<IconLogin size={16} />}
            onClick={() => openAuthModal("login")}
            disabled={status === "loading"}
          >
            Войти
          </Button>
        )}

        <Group gap="xs">
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
        </Group>
      </Group>

      <Group mt="xs" gap="xs" wrap="nowrap" className={classes.chipsRow}>
        <div
          className={classes.chipsScroller}
          ref={chipsScrollerRef}
          style={{ display: "flex", justifyContent: "center", gap: "4px" }}
        >
          <Chip.Group
            className={classes.chipsGroup}
            multiple
            value={selectedAmenities}
            onChange={(v) => onChangeAmenities(v as Amenity[])}
          >
            {visibleAmenities.map((a) => {
              const isChecked = selectedAmenities.includes(a);
              return (
                <Chip
                  className="main-filters"
                  key={a}
                  value={a}
                  size="xs"
                  radius="xl"
                  variant="filled"
                  icon={null}
                  styles={{
                    iconWrapper: { display: "none" },
                    label: {
                      ...amenityChipLabelStyles.base,
                      ...(isChecked ? amenityChipLabelStyles.checked : null),
                    },
                  }}
                >
                  {AMENITY_LABELS[a]}
                </Chip>
              );
            })}
          </Chip.Group>
        </div>
      </Group>

      {(topTagsLoading || hasTopTags) && (
        <Box mt={6} className={classes.topTagsRow}>
          <Text size="xs" className={classes.topTagsTitle}>
            {topTagsSource === "user_favorites" ? "Ваши теги" : "Популярные теги"}
          </Text>
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
        </Box>
      )}

      {showFetchingBadge && (
        <Box mt="xs" className={classes.fetchRow}>
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
        </Box>
      )}

      <div className={classes.chipsMeasure} aria-hidden="true">
        {allAmenities.map((a) => {
          const isChecked = selectedAmenities.includes(a);
          return (
            <span
              key={a}
              ref={(el) => {
                chipMeasureRefs.current[a] = el;
              }}
              className={classes.chipMeasureItem}
            >
              <Chip
                value={a}
                size="xs"
                radius="xl"
                variant="filled"
                icon={null}
                styles={{
                  iconWrapper: { display: "none" },
                  label: {
                    ...amenityChipLabelStyles.base,
                    ...(isChecked ? amenityChipLabelStyles.checked : null),
                  },
                }}
              >
                {AMENITY_LABELS[a]}
              </Chip>
            </span>
          );
        })}
      </div>
    </Box>
  );
}
