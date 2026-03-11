import { useQuery } from "@tanstack/react-query";
import { IconMessageCircle, IconStarFilled, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getCafeRatingSnapshot, type CafeRatingSnapshot } from "../../../../api/reviews";
import { getMyTasteMap } from "../../../../api/taste";
import { useAuth } from "../../../../components/AuthGate";
import { Badge, Popover, PopoverContent, PopoverTrigger } from "../../../../components/ui";
import type { Cafe } from "../../../../entities/cafe/model/types";
import { isTasteMapV1Enabled } from "../../../taste/model/flags";
import { getTasteLabel } from "../../../taste/model/tasteLabels";
import { resolveCafeDisplayRating } from "../../utils/ratingDisplay";

type CafeCardFooterProps = {
  cafe: Cafe;
  ratingRefreshToken?: number;
  showRoutes?: boolean;
};

const cafeRatingSnapshotCache = new Map<string, CafeRatingSnapshot>();

export function invalidateCafeCardRatingSnapshot(cafeId?: string) {
  if (cafeId && cafeId.trim()) {
    cafeRatingSnapshotCache.delete(cafeId.trim());
    return;
  }
  cafeRatingSnapshotCache.clear();
}

export default function CafeCardFooter({
  cafe,
  ratingRefreshToken = 0,
  showRoutes = true,
}: CafeCardFooterProps) {
  const { user, status } = useAuth();
  const tasteMapEnabled = isTasteMapV1Enabled();
  const tasteExplainability = (cafe.explainability ?? "").trim();
  const [tastePopoverOpen, setTastePopoverOpen] = useState(false);
  const lastAppliedRefreshTokenRef = useRef(0);
  const [ratingState, setRatingState] = useState<{
    cafeId: string;
    snapshot: CafeRatingSnapshot | null;
    loading: boolean;
  }>(() => {
    const cached = cafeRatingSnapshotCache.get(cafe.id) ?? null;
    return {
      cafeId: cafe.id,
      snapshot: cached,
      loading: !cached,
    };
  });
  const cachedSnapshot = cafeRatingSnapshotCache.get(cafe.id) ?? null;
  const ratingSnapshot =
    ratingState.cafeId === cafe.id ? ratingState.snapshot : cachedSnapshot;
  const ratingLoading =
    ratingState.cafeId === cafe.id ? ratingState.loading : !cachedSnapshot;

  useEffect(() => {
    let cancelled = false;
    let loadingTimer: number | null = null;
    const forceRefresh = ratingRefreshToken > lastAppliedRefreshTokenRef.current;
    if (forceRefresh) {
      lastAppliedRefreshTokenRef.current = ratingRefreshToken;
    }
    const cachedForCafe = cafeRatingSnapshotCache.get(cafe.id) ?? null;
    if (cachedForCafe && !forceRefresh) {
      return () => {
        cancelled = true;
      };
    }

    loadingTimer = window.setTimeout(() => {
      if (cancelled) return;
      setRatingState((prev) => ({
        cafeId: cafe.id,
        snapshot: prev.cafeId === cafe.id ? prev.snapshot : cachedForCafe,
        loading: true,
      }));
    }, 0);

    getCafeRatingSnapshot(cafe.id)
      .then((snapshot) => {
        if (cancelled) return;
        if (loadingTimer != null) {
          window.clearTimeout(loadingTimer);
          loadingTimer = null;
        }
        cafeRatingSnapshotCache.set(cafe.id, snapshot);
        setRatingState({
          cafeId: cafe.id,
          snapshot,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (loadingTimer != null) {
          window.clearTimeout(loadingTimer);
          loadingTimer = null;
        }
        setRatingState({
          cafeId: cafe.id,
          snapshot: null,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
      if (loadingTimer != null) {
        window.clearTimeout(loadingTimer);
        loadingTimer = null;
      }
    };
  }, [cafe.id, ratingRefreshToken]);

  const hasReviewStats = (ratingSnapshot?.reviews_count ?? 0) > 0;
  const shouldLoadTasteProfile = Boolean(
    tasteMapEnabled && status === "authed" && user?.id && tasteExplainability,
  );
  const tasteMapQuery = useQuery({
    queryKey: ["my_taste_map", "discovery_card", user?.id ?? ""],
    queryFn: getMyTasteMap,
    enabled: shouldLoadTasteProfile,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
  const tasteTooltipPayload = useMemo(() => {
    if (!tasteExplainability) return null;
    const activeTags = tasteMapQuery.data?.active_tags ?? [];
    if (!Array.isArray(activeTags) || activeTags.length === 0) return null;

    const rankedPositiveTags = activeTags
      .filter((item) => item.polarity === "positive")
      .sort((a, b) => {
        const leftScore = Math.abs(a.score) * a.confidence;
        const rightScore = Math.abs(b.score) * b.confidence;
        return rightScore - leftScore;
      });

    const seen = new Set<string>();
    const labels: string[] = [];
    for (const item of rankedPositiveTags) {
      const label = getTasteLabel(item.taste_code).trim();
      if (!label) continue;
      const normalizedKey = label.toLowerCase();
      if (seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);
      labels.push(label.charAt(0).toLowerCase() + label.slice(1));
      if (labels.length >= 2) break;
    }

    if (labels.length < 2) return null;
    return {
      likesLine: `Любите: ${labels.join(", ")}.`,
      contextLine: "Здесь это часто отмечают в отзывах.",
    };
  }, [tasteExplainability, tasteMapQuery.data?.active_tags]);
  const showTasteHint = Boolean(tasteTooltipPayload);
  const displayRating = useMemo(
    () => resolveCafeDisplayRating(ratingSnapshot),
    [ratingSnapshot],
  );
  const ratingLabel = useMemo(() => {
    if (displayRating.value === null) return "";
    return displayRating.value.toFixed(1);
  }, [displayRating.value]);

  const lineClampSingleStyle = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 1,
    overflow: "hidden",
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 3,
      }}
    >
      {showTasteHint ? (
        <div
          style={{
            position: "absolute",
            top: "var(--page-edge-padding)",
            right: showRoutes
              ? "calc(var(--page-edge-padding) + 98px)"
              : "var(--page-edge-padding)",
            zIndex: 4,
          }}
        >
          <Popover open={tastePopoverOpen} onOpenChange={setTastePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Почему подходит по вкусу"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  border: "1px solid color-mix(in srgb, var(--glass-border) 92%, transparent)",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 92%, transparent), color-mix(in srgb, var(--surface) 74%, transparent))",
                  color: "var(--cafe-hero-emphasis-color)",
                  fontSize: "0.98rem",
                  lineHeight: 1,
                  cursor: "pointer",
                  boxShadow:
                    "0 4px 12px color-mix(in srgb, var(--color-surface-overlay-strong) 18%, transparent)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                🎯
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={10}
              onClick={(event) => event.stopPropagation()}
              className="w-[min(280px,86vw)] rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface)] p-0 text-[color:var(--text)] shadow-[var(--glass-shadow)] backdrop-blur-md"
            >
              <div style={{ padding: "10px 12px 12px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--cafe-hero-emphasis-color)",
                    }}
                  >
                    Подбор по вкусу
                  </p>
                  <button
                    type="button"
                    aria-label="Закрыть подсказку"
                    onClick={() => setTastePopoverOpen(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--muted)",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    <IconX size={14} />
                  </button>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.78rem",
                    lineHeight: 1.35,
                    color: "var(--text)",
                  }}
                >
                  {tasteTooltipPayload?.likesLine}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.76rem",
                    lineHeight: 1.35,
                    color: "var(--muted)",
                  }}
                >
                  {tasteTooltipPayload?.contextLine}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: "var(--page-edge-padding)",
          right: "var(--page-edge-padding)",
          bottom: 0,
          borderRadius: 14,
          border: "1px solid color-mix(in srgb, var(--glass-border) 82%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--surface) 86%, transparent), color-mix(in srgb, var(--surface) 62%, transparent))",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "8px 10px",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              title={cafe.name}
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--cafe-hero-emphasis-color)",
                textShadow: "0 1px 2px color-mix(in srgb, var(--cafe-hero-overlay-3) 26%, transparent)",
                ...lineClampSingleStyle,
              }}
            >
              {cafe.name}
            </p>
            <p
              title={cafe.address}
              style={{
                margin: "2px 0 0",
                fontSize: "0.875rem",
                color: "color-mix(in srgb, var(--cafe-hero-subtitle-color) 92%, var(--text))",
                textShadow: "0 1px 2px color-mix(in srgb, var(--cafe-hero-overlay-3) 18%, transparent)",
                ...lineClampSingleStyle,
              }}
            >
              {cafe.address}
            </p>
          </div>
          <div
            style={{
              minWidth: 74,
              display: "grid",
              justifyItems: "end",
              gap: 6,
              alignContent: "end",
            }}
          >
            {ratingLoading ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "var(--cafe-hero-subtitle-color)",
                }}
              >
                ...
              </p>
            ) : hasReviewStats ? (
              <>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconStarFilled size={14} color="var(--cafe-hero-emphasis-color)" />
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "var(--cafe-hero-emphasis-color)",
                    }}
                  >
                    {ratingLabel}
                  </p>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconMessageCircle size={14} color="var(--cafe-hero-subtitle-color)" />
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.875rem",
                      color: "var(--cafe-hero-subtitle-color)",
                    }}
                  >
                    {ratingSnapshot?.reviews_count ?? 0}
                  </p>
                </div>
              </>
            ) : (
              <Badge
                variant="secondary"
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[0.75rem] font-semibold text-[var(--text)]"
              >
                new
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
