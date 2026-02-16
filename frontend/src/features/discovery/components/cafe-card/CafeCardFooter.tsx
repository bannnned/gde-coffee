import { Badge, Box, Group, Text } from "@mantine/core";

import type { Cafe } from "../../../../entities/cafe/model/types";
import { AMENITY_LABELS } from "../../constants";

type CafeCardFooterProps = {
  cafe: Cafe;
  badgeStyles: any;
};

export default function CafeCardFooter({ cafe, badgeStyles }: CafeCardFooterProps) {
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
