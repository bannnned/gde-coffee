import {
  Badge,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  useComputedColorScheme,
  useMantineTheme,
} from "@mantine/core";

import type { Cafe } from "../types";
import { AMENITY_LABELS } from "../constants";
import { formatDistance } from "../utils";

type CafeDetailsScreenProps = {
  opened: boolean;
  cafe: Cafe | null;
  onClose: () => void;
};

export default function CafeDetailsScreen({
  opened,
  cafe,
  onClose,
}: CafeDetailsScreenProps) {
  const scheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const theme = useMantineTheme();

  if (!cafe) return null;

  const modalStyles = {
    content: {
      background:
        scheme === "dark"
          ? "rgba(26, 26, 26, 0.9)"
          : "rgba(255, 255, 240, 0.98)",
      backdropFilter: "blur(18px) saturate(160%)",
      WebkitBackdropFilter: "blur(18px) saturate(160%)",
    },
    header: {
      background:
        scheme === "dark"
          ? "rgba(26, 26, 26, 0.82)"
          : "rgba(255, 255, 240, 0.92)",
      borderBottom: `1px solid ${
        scheme === "dark"
          ? "rgba(255, 255, 240, 0.14)"
          : "rgba(26, 26, 26, 0.08)"
      }`,
    },
    title: {
      fontWeight: 700,
    },
    body: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    overlay: {
      backdropFilter: "blur(4px)",
      backgroundColor:
        scheme === "dark"
          ? "rgba(26, 26, 26, 0.65)"
          : "rgba(26, 26, 26, 0.35)",
    },
  } as const;

  const cardStyles = {
    background:
      scheme === "dark"
        ? "linear-gradient(135deg, rgba(26,26,26,0.78), rgba(26,26,26,0.6))"
        : "linear-gradient(135deg, rgba(255,255,240,0.94), rgba(255,255,240,0.72))",
    border:
      scheme === "dark"
        ? "1px solid rgba(255, 255, 240, 0.16)"
        : "1px solid rgba(26, 26, 26, 0.1)",
    boxShadow:
      scheme === "dark"
        ? "0 18px 40px rgba(0, 0, 0, 0.6), 0 8px 20px rgba(0, 0, 0, 0.45)"
        : "0 18px 40px rgba(26, 26, 26, 0.14), 0 8px 18px rgba(26, 26, 26, 0.12)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
  } as const;

  const badgeStyles = {
    root: {
      background:
        scheme === "dark"
          ? "rgba(255, 255, 240, 0.08)"
          : "rgba(255, 255, 240, 0.7)",
      border:
        scheme === "dark"
          ? "1px solid rgba(255, 255, 240, 0.18)"
          : "1px solid rgba(26, 26, 26, 0.12)",
      color: scheme === "dark" ? "rgba(255, 255, 240, 0.95)" : "#1A1A1A",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    },
  } as const;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      fullScreen
      withCloseButton
      title={cafe.name}
      styles={modalStyles}
    >
      <Paper withBorder radius="lg" p="md" style={cardStyles}>
        <Stack gap="xs">
          <Text c="dimmed" size="sm">
            {cafe.address}
          </Text>
          <Text size="sm">{formatDistance(cafe.distance_m)}</Text>
          {cafe.amenities.length > 0 && (
            <Group gap={6} wrap="wrap">
              {cafe.amenities.map((a) => (
                <Badge key={a} variant="light" styles={badgeStyles}>
                  {AMENITY_LABELS[a] ?? a}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>
      </Paper>
    </Modal>
  );
}
