import { IconMessageCircle, IconStarFilled } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { getCafeRatingSnapshot, type CafeRatingSnapshot } from "../../../../api/reviews";
import { Badge } from "../../../../components/ui";
import type { Cafe } from "../../../../entities/cafe/model/types";
import { resolveCafeDisplayRating } from "../../utils/ratingDisplay";

type CafeCardFooterProps = {
  cafe: Cafe;
  ratingRefreshToken?: number;
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
}: CafeCardFooterProps) {
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
    const forceRefresh = ratingRefreshToken > 0;
    if (cachedSnapshot && !forceRefresh) {
      setRatingState({
        cafeId: cafe.id,
        snapshot: cachedSnapshot,
        loading: false,
      });
      return () => {
        cancelled = true;
      };
    }

    setRatingState((prev) => ({
      cafeId: cafe.id,
      snapshot: prev.cafeId === cafe.id ? prev.snapshot : cachedSnapshot,
      loading: true,
    }));

    getCafeRatingSnapshot(cafe.id)
      .then((snapshot) => {
        if (cancelled) return;
        cafeRatingSnapshotCache.set(cafe.id, snapshot);
        setRatingState({
          cafeId: cafe.id,
          snapshot,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setRatingState({
          cafeId: cafe.id,
          snapshot: null,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cafe.id, cachedSnapshot, ratingRefreshToken]);

  const hasReviewStats = (ratingSnapshot?.reviews_count ?? 0) > 0;
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
        bottom: 0,
        padding: "0 var(--page-edge-padding)",
        zIndex: 3,
      }}
    >
      <div
        style={{
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
