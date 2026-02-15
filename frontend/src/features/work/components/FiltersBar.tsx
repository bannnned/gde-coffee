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
import { IconLogin } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { ColorSchemeToggle } from "../../../components/ColorSchemeToggle";
import { useAuth } from "../../../components/AuthGate";
import type { Amenity } from "../types";
import { AMENITY_LABELS, WORK_ICONS, WORK_UI_TEXT } from "../constants";
import classes from "./FiltersBar.module.css";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";
import { resolveAvatarUrl } from "../../../utils/resolveAvatarUrl";

type FiltersBarProps = {
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
  onOpenSettings: () => void;
  showFetchingBadge: boolean;
  highlightSettingsButton?: boolean;
};

const CHIP_GAP_PX = 4;

export default function FiltersBar({
  selectedAmenities,
  onChangeAmenities,
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

  const amenityChipLabelBaseStyles = {
    boxSizing: "border-box",
    minWidth: 72,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    fontWeight: 500,
    fontSize: theme.fontSizes.xs,
    lineHeight: 1,
    letterSpacing: 0,
    transform: "none",
    paddingInline: 10,
    paddingBlock: 8,
    border: "1px solid var(--border)",
    color: "var(--text)",
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
    boxShadow: "var(--glass-shadow)",
    outline: "none",
    "&:active": {
      transform: "none",
    },
  } as const;

  const amenityChipLabelCheckedStyles = {
    background: "var(--color-brand-accent-soft)",
    borderColor: "var(--accent)",
    boxShadow: "0 8px 20px var(--attention-glow)",
    transform: "none",
  } as const;

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
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      setFiltersBarHeight(0);
    };
  }, [setFiltersBarHeight]);

  return (
    <Box
      pos="absolute"
      top={0}
      left={0}
      right={0}
      p="sm"
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
            onClick={() => navigate("/profile")}
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
          <ActionIcon
            variant="transparent"
            size={42}
            className={`glass-action glass-action--square ${
              highlightSettingsButton ? classes.attentionButton : ""
            }`}
            aria-label={WORK_UI_TEXT.settingsAria}
            onClick={onOpenSettings}
          >
            <WORK_ICONS.settings size={18} />
          </ActionIcon>

          <ColorSchemeToggle />
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
                      ...amenityChipLabelBaseStyles,
                      ...(isChecked ? amenityChipLabelCheckedStyles : null),
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
            {WORK_UI_TEXT.fetching}
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
                    ...amenityChipLabelBaseStyles,
                    ...(isChecked ? amenityChipLabelCheckedStyles : null),
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
