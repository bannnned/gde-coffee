import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Chip,
  Group,
  Text,
  UnstyledButton,
  useComputedColorScheme,
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

type FiltersBarProps = {
  selectedAmenities: Amenity[];
  onChangeAmenities: (next: Amenity[]) => void;
  onOpenSettings: () => void;
  showFetchingBadge: boolean;
};

const CHIP_GAP_PX = 4;

export default function FiltersBar({
  selectedAmenities,
  onChangeAmenities,
  onOpenSettings,
  showFetchingBadge,
}: FiltersBarProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
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
    paddingBlock: 6,
    border: `1px solid ${
      scheme === "dark"
        ? "rgba(255, 255, 240, 0.18)"
        : "rgba(26, 26, 26, 0.12)"
    }`,
    color: scheme === "dark" ? "rgba(255, 255, 240, 0.95)" : "#1A1A1A",
    backdropFilter: "blur(18px) saturate(180%)",
    WebkitBackdropFilter: "blur(18px) saturate(180%)",
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(26,26,26,0.7), rgba(26,26,26,0.5))"
        : "linear-gradient(135deg, rgba(255,255,240,0.92), rgba(255,255,240,0.68))",
    boxShadow:
      scheme === "dark"
        ? "0 6px 18px rgba(0, 0, 0, 0.5)"
        : "0 6px 16px rgba(26, 26, 26, 0.14)",
    outline: "none",
    "&:active": {
      transform: "none",
    },
  } as const;

  const amenityChipLabelCheckedStyles = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(69,126,115,0.45), rgba(69,126,115,0.3))"
        : "linear-gradient(135deg, rgba(69,126,115,0.35), rgba(69,126,115,0.2))",
    borderColor:
      scheme === "dark" ? "rgba(69,126,115,0.55)" : "rgba(69,126,115,0.45)",
    boxShadow:
      scheme === "dark"
        ? "0 8px 20px rgba(69, 126, 115, 0.35)"
        : "0 8px 18px rgba(69, 126, 115, 0.25)",
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
  }, [allAmenities, selectedKey, scheme, theme.fontSizes.xs]);

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
            title={user.displayName ?? user.email ?? ""}
          >
            <Text fw={700}>
              {(user.displayName || user.email || "?")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </Text>
          </UnstyledButton>
        ) : (
          <Button
            size="xs"
            variant="transparent"
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
            className="glass-action glass-action--square"
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
                background:
                  scheme === "dark"
                    ? "rgba(69,126,115,0.6)"
                    : "rgba(69,126,115,0.85)",
                color: "#FFFFF0",
                border:
                  scheme === "dark"
                    ? "1px solid rgba(69,126,115,0.5)"
                    : "1px solid rgba(69,126,115,0.35)",
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
