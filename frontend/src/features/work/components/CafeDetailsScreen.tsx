import {
  Badge,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";

import type { Cafe } from "../types";
import { AMENITY_LABELS } from "../constants";
import { formatDistance } from "../utils";

type CafeDetailsScreenProps = {
  opened: boolean;
  cafe: Cafe | null;
  onClose: () => void;
  showDistance?: boolean;
};

export default function CafeDetailsScreen({
  opened,
  cafe,
  onClose,
  showDistance = true,
}: CafeDetailsScreenProps) {
  const theme = useMantineTheme();
  const photos = cafe?.photos ?? [];
  const coverPhotoUrl = cafe?.cover_photo_url ?? photos[0]?.url;

  if (!cafe) return null;

  const modalStyles = {
    content: {
      background: "var(--glass-bg)",
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow)",
      backdropFilter: "blur(18px) saturate(160%)",
      WebkitBackdropFilter: "blur(18px) saturate(160%)",
    },
    header: {
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
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
      backgroundColor: "var(--color-surface-overlay-strong)",
    },
  } as const;

  const cardStyles = {
    background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
    border: "1px solid var(--glass-border)",
    boxShadow: "var(--shadow)",
    backdropFilter: "blur(18px) saturate(160%)",
    WebkitBackdropFilter: "blur(18px) saturate(160%)",
  } as const;

  const badgeStyles = {
    root: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      color: "var(--text)",
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
          {coverPhotoUrl && (
            <Paper
              withBorder
              radius="md"
              style={{
                overflow: "hidden",
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <img
                src={coverPhotoUrl}
                alt={`Фото: ${cafe.name}`}
                style={{
                  width: "100%",
                  maxHeight: 260,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </Paper>
          )}
          {photos.length > 1 && (
            <Group wrap="nowrap" gap={8} style={{ overflowX: "auto", paddingBottom: 2 }}>
              {photos.map((photo) => (
                <Paper
                  key={photo.id}
                  withBorder
                  radius="sm"
                  style={{
                    width: 96,
                    minWidth: 96,
                    height: 72,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  <img
                    src={photo.url}
                    alt={`Фото: ${cafe.name}`}
                    loading="lazy"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </Paper>
              ))}
            </Group>
          )}
          <Text c="dimmed" size="sm">
            {cafe.address}
          </Text>
          {showDistance && <Text size="sm">{formatDistance(cafe.distance_m)}</Text>}
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
