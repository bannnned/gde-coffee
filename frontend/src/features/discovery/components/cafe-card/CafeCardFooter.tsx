import { Badge, Box, Group, Text } from "@mantine/core";
import { IconMessageCircle, IconStarFilled } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { getCafeRatingSnapshot, type CafeRatingSnapshot } from "../../../../api/reviews";
import type { Cafe } from "../../../../entities/cafe/model/types";
import { AMENITY_LABELS } from "../../constants";

type CafeCardFooterProps = {
  cafe: Cafe;
  badgeStyles: Record<string, unknown>;
};

const cafeRatingSnapshotCache = new Map<string, CafeRatingSnapshot>();

export default function CafeCardFooter({ cafe, badgeStyles }: CafeCardFooterProps) {
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
    if (cachedSnapshot) {
      return () => {
        cancelled = true;
      };
    }

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
  }, [cafe.id, cachedSnapshot]);

  const hasReviewStats = (ratingSnapshot?.reviews_count ?? 0) > 0;
  const ratingLabel = useMemo(() => {
    if (!ratingSnapshot) return "";
    return ratingSnapshot.rating.toFixed(1);
  }, [ratingSnapshot]);

  return (
    <Box
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "0 var(--page-edge-padding)",
        zIndex: 3,
      }}
    >
      <Box
        style={{
          borderRadius: 14,
          border: "1px solid color-mix(in srgb, var(--glass-border) 82%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--surface) 86%, transparent), color-mix(in srgb, var(--surface) 62%, transparent))",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "8px 10px",
        }}
      >
        <Group justify="space-between" align="flex-end" gap={10} wrap="nowrap">
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text
              fw={700}
              size="md"
              lineClamp={1}
              title={cafe.name}
              style={{
                color: "var(--cafe-hero-emphasis-color)",
                textShadow: "0 1px 2px color-mix(in srgb, var(--cafe-hero-overlay-3) 26%, transparent)",
              }}
            >
              {cafe.name}
            </Text>
            <Text
              size="sm"
              lineClamp={1}
              title={cafe.address}
              style={{
                color: "color-mix(in srgb, var(--cafe-hero-subtitle-color) 92%, var(--text))",
                textShadow: "0 1px 2px color-mix(in srgb, var(--cafe-hero-overlay-3) 18%, transparent)",
              }}
            >
              {cafe.address}
            </Text>
          </Box>
          <Box
            style={{
              minWidth: 74,
              display: "grid",
              justifyItems: "end",
              gap: 6,
              alignContent: "end",
            }}
          >
            {ratingLoading ? (
              <Text size="xs" style={{ color: "var(--cafe-hero-subtitle-color)" }}>
                ...
              </Text>
            ) : hasReviewStats ? (
              <>
                <Group gap={4} wrap="nowrap">
                  <IconStarFilled size={14} color="var(--cafe-hero-emphasis-color)" />
                  <Text fw={700} size="sm" style={{ color: "var(--cafe-hero-emphasis-color)" }}>
                    {ratingLabel}
                  </Text>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <IconMessageCircle size={14} color="var(--cafe-hero-subtitle-color)" />
                  <Text size="sm" style={{ color: "var(--cafe-hero-subtitle-color)" }}>
                    {ratingSnapshot?.reviews_count ?? 0}
                  </Text>
                </Group>
              </>
            ) : (
              <Badge variant="light" radius="xl" styles={badgeStyles}>
                new
              </Badge>
            )}
          </Box>
        </Group>
      </Box>
      <Group
        gap={6}
        mt={8}
        wrap="nowrap"
        style={{
          overflow: "hidden",
          WebkitMaskImage: "linear-gradient(90deg, currentColor 80%, transparent)",
          maskImage: "linear-gradient(90deg, currentColor 80%, transparent)",
        }}
      >
        {cafe.amenities.map((a) => (
          <Badge key={a} variant="light" styles={badgeStyles}>
            {AMENITY_LABELS[a] ?? a}
          </Badge>
        ))}
      </Group>
    </Box>
  );
}
