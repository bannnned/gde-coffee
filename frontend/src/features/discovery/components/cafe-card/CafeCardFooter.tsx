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
        padding: "44px 14px 12px",
        zIndex: 3,
      }}
    >
      <Group justify="space-between" align="flex-start" gap={10} wrap="nowrap">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text
            fw={700}
            size="md"
            lineClamp={1}
            title={cafe.name}
            style={{ color: "var(--cafe-hero-title-color)" }}
          >
            {cafe.name}
          </Text>
          <Text
            size="sm"
            lineClamp={1}
            title={cafe.address}
            style={{ color: "var(--cafe-hero-subtitle-color)" }}
          >
            {cafe.address}
          </Text>
        </Box>
        <Box
          style={{
            minWidth: 92,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            paddingTop: 2,
          }}
        >
          {ratingLoading ? (
            <Text size="xs" style={{ color: "var(--cafe-hero-subtitle-color)" }}>
              ...
            </Text>
          ) : hasReviewStats ? (
            <Group gap={8} wrap="nowrap">
              <Group gap={4} wrap="nowrap">
                <IconStarFilled size={14} color="var(--cafe-hero-title-color)" />
                <Text fw={600} size="sm" style={{ color: "var(--cafe-hero-title-color)" }}>
                  {ratingLabel}
                </Text>
              </Group>
              <Group gap={4} wrap="nowrap">
                <IconMessageCircle size={14} color="var(--cafe-hero-subtitle-color)" />
                <Text size="sm" style={{ color: "var(--cafe-hero-subtitle-color)" }}>
                  {ratingSnapshot?.reviews_count ?? 0}
                </Text>
              </Group>
            </Group>
          ) : (
            <Badge variant="light" radius="xl" styles={badgeStyles}>
              new
            </Badge>
          )}
        </Box>
      </Group>
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
