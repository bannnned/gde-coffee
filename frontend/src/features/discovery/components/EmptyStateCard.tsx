import {
  IconAlertCircle,
  IconCheck,
  IconMapPinOff,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { Button } from "../../../components/ui";
import { AppSelect } from "../../../ui/bridge";
import { DISCOVERY_UI_TEXT } from "../constants";
import classes from "./EmptyStateCard.module.css";

type EmptyState = "no-results" | "no-geo" | "error";

type EmptyStateCardProps = {
  emptyState: EmptyState;
  isError: boolean;
  isLocating?: boolean;
  onResetFilters: () => void;
  onRetry: () => void;
  onLocate: () => void;
  locationOptions?: Array<{ id: string; label: string }>;
  onSelectLocation?: (id: string) => void;
};

export default function EmptyStateCard({
  emptyState,
  isError,
  isLocating,
  onResetFilters,
  onRetry,
  onLocate,
  locationOptions = [],
  onSelectLocation,
}: EmptyStateCardProps) {
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const emptyConfig =
    isError || emptyState === "error"
      ? {
          icon: IconAlertCircle,
          title: DISCOVERY_UI_TEXT.emptyErrorTitle,
          subtitle: DISCOVERY_UI_TEXT.emptyErrorSubtitle,
          actionLabel: DISCOVERY_UI_TEXT.retry,
          onAction: onRetry,
        }
        : emptyState === "no-geo"
        ? {
            icon: IconMapPinOff,
            title: DISCOVERY_UI_TEXT.emptyNoGeoTitle,
            subtitle: DISCOVERY_UI_TEXT.emptyNoGeoSubtitle,
            actionLabel: DISCOVERY_UI_TEXT.locate,
            onAction: onLocate,
          }
        : {
            icon: null,
            title: DISCOVERY_UI_TEXT.emptyTitle,
            subtitle: DISCOVERY_UI_TEXT.emptySubtitle,
            actionLabel: DISCOVERY_UI_TEXT.resetFilters,
            onAction: onResetFilters,
          };

  const compactNoResults = emptyState === "no-results" && !isError;
  const locateMode = emptyState === "no-geo" && !isError;
  const locateLoading = emptyState === "no-geo" && Boolean(isLocating);
  const EmptyIcon = emptyConfig.icon;
  const locationSelectData = useMemo(
    () =>
      locationOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    [locationOptions],
  );
  const canApplyLocation =
    emptyState === "no-geo" &&
    Boolean(pendingLocationId) &&
    Boolean(onSelectLocation);
  const selectStyles = {
    input: {
      height: 40,
      borderRadius: 14,
      border: "1px solid var(--border)",
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--surface) 86%, transparent), color-mix(in srgb, var(--surface) 72%, transparent))",
      color: "var(--text)",
    },
    dropdown: {
      borderRadius: 14,
      border: "1px solid var(--glass-border)",
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--surface) 88%, transparent))",
      boxShadow:
        "0 12px 24px color-mix(in srgb, var(--color-surface-overlay-soft) 58%, transparent)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
  } as const;

  return (
    <div
      className={`${classes.card} ${compactNoResults ? classes.cardCompact : ""}`}
      data-empty-state={emptyState}
    >
      <div
        className={classes.stack}
        style={{ gap: compactNoResults ? 6 : 8 }}
      >
        {EmptyIcon && (
          <div className={classes.iconWrap}>
            <EmptyIcon size={22} />
          </div>
        )}
        <p className={classes.title}>{emptyConfig.title}</p>
        <p className={classes.subtitle}>{emptyConfig.subtitle}</p>
        <Button
          size="sm"
          onClick={emptyConfig.onAction}
          disabled={locateLoading}
          aria-busy={locateLoading ? "true" : undefined}
          className={[
            classes.actionButton,
            locateMode ? classes.actionButtonLocate : classes.actionButtonDefault,
            locateLoading ? classes.actionButtonBusy : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className={classes.actionLabel}>{emptyConfig.actionLabel}</span>
          {locateLoading ? (
            <span className={classes.spinner} aria-hidden="true" />
          ) : null}
        </Button>
        {emptyState === "no-geo" && locationSelectData.length > 0 && (
          <div className={classes.locationBlock}>
            <p className={classes.locationHint}>
              или выберите город
            </p>
            <div
              className={classes.locationRow}
              style={{ gridTemplateColumns: canApplyLocation ? "1fr auto" : "1fr" }}
            >
              <AppSelect
                data={locationSelectData}
                value={pendingLocationId}
                placeholder="Выбрать город"
                searchable
                nothingFoundMessage="Ничего не найдено"
                onChange={setPendingLocationId}
                styles={selectStyles}
              />
              {canApplyLocation && (
                <button
                  type="button"
                  className={`${classes.confirmButton} ui-focus-ring`}
                  aria-label="Подтвердить город"
                  onClick={() => {
                    if (!pendingLocationId || !onSelectLocation) return;
                    onSelectLocation(pendingLocationId);
                    setPendingLocationId(null);
                  }}
                >
                  <IconCheck size={18} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
