import { Box, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { IconCamera, IconCameraPlus, IconPlus } from "@tabler/icons-react";

import type { Cafe, CafePhoto } from "../../../../../entities/cafe/model/types";
import {
  buildCafePhotoPictureSources,
  buildCafePhotoSrcSet,
} from "../../../../../utils/cafePhotoVariants";

type MenuSectionProps = {
  cafe: Cafe;
  menuMainPhoto: CafePhoto | null;
  menuPhotoItems: CafePhoto[];
  specificTags: string[];
  menuActiveIndex: number;
  menuImageReady: boolean;
  isPhotoProcessing?: boolean;
  onOpenViewer: () => void;
  onMenuMainPhotoLoad: (src: string) => void;
  onMenuMainPhotoError: () => void;
  onSelectMenuPhoto: (index: number) => void;
  onManagePhotos?: (kind: "cafe" | "menu") => void;
};

function formatPhotoAddedDate(photo: CafePhoto | null): string | null {
  if (!photo) return null;
  const source = photo as CafePhoto & {
    created_at?: string;
    uploaded_at?: string;
    added_at?: string;
  };
  const rawDate = source.created_at || source.uploaded_at || source.added_at;
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MenuSection({
  cafe,
  menuMainPhoto,
  menuPhotoItems,
  specificTags,
  menuActiveIndex,
  menuImageReady,
  isPhotoProcessing = false,
  onOpenViewer,
  onMenuMainPhotoLoad,
  onMenuMainPhotoError,
  onSelectMenuPhoto,
  onManagePhotos,
}: MenuSectionProps) {
  const menuMainSources = buildCafePhotoPictureSources(menuMainPhoto?.url, [640, 1024, 1536]);
  const menuThumbSizes = "108px";
  const menuPhotoAddedDate = formatPhotoAddedDate(menuMainPhoto);

  return (
    <Stack gap={0}>
      {menuMainPhoto ? (
        <Box
          onClick={onOpenViewer}
          style={{
            overflow: "hidden",
            cursor: "pointer",
          }}
        >
          <picture style={{ display: "block" }}>
            {menuMainSources.avifSrcSet && (
              <source
                type="image/avif"
                srcSet={menuMainSources.avifSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            {menuMainSources.webpSrcSet && (
              <source
                type="image/webp"
                srcSet={menuMainSources.webpSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            <img
              src={menuMainPhoto.url}
              srcSet={menuMainSources.fallbackSrcSet}
              sizes="(max-width: 768px) 100vw, 960px"
              alt={`Меню: ${cafe.name}`}
              loading="lazy"
              onLoad={(event) => onMenuMainPhotoLoad(event.currentTarget.currentSrc || event.currentTarget.src)}
              onError={onMenuMainPhotoError}
              style={{
                width: "100%",
                height: 260,
                objectFit: "cover",
                display: "block",
                opacity: menuImageReady ? 1 : 0.38,
                filter: menuImageReady ? "blur(0px)" : "blur(2px)",
                transition: "opacity 220ms ease, filter 240ms ease",
              }}
            />
          </picture>
        </Box>
      ) : (
        <Box
          style={{
            height: 260,
            display: "grid",
            placeItems: "center",
            padding: "18px var(--page-edge-padding)",
            background:
              "radial-gradient(circle at 78% 24%, color-mix(in srgb, var(--bg-accent-2) 52%, transparent), transparent 45%), linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          {onManagePhotos && (
            <Button
              size="sm"
              radius="xl"
              variant="light"
              loading={isPhotoProcessing}
              leftSection={<IconCameraPlus size={16} />}
              onClick={() => onManagePhotos("menu")}
              styles={{
                root: {
                  height: 44,
                  marginTop: 4,
                  paddingInline: 16,
                  border: "1px solid color-mix(in srgb, var(--color-brand-accent) 45%, var(--glass-border))",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 68%, var(--surface)), var(--surface))",
                  color: "var(--cafe-hero-emphasis-color)",
                  fontWeight: 700,
                  boxShadow: "var(--glass-shadow)",
                },
              }}
            >
              Добавить первое фото
            </Button>
          )}
        </Box>
      )}

      {menuPhotoAddedDate && (
        <Box
          py={8}
          style={{
            borderBottom: "1px solid var(--border)",
            paddingInline: "var(--page-edge-padding)",
          }}
        >
          <Text size="xs" c="dimmed">
            Фото меню добавлено: {menuPhotoAddedDate}
          </Text>
        </Box>
      )}

      {specificTags.length > 0 && (
        <Group
          className="horizontal-scroll-modern"
          wrap="nowrap"
          gap={8}
          pt="sm"
          pb={menuPhotoItems.length > 1 ? 0 : "sm"}
          style={{
            overflowX: "auto",
            paddingInline: "var(--page-edge-padding)",
          }}
        >
          {specificTags.slice(0, 10).map((tag) => (
            <Paper
              key={tag}
              withBorder
              radius="xl"
              px="sm"
              py={4}
              style={{
                border: "1px solid color-mix(in srgb, var(--accent) 28%, var(--glass-border))",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 42%, var(--surface)), color-mix(in srgb, var(--glass-grad-1) 88%, var(--surface)))",
                color: "var(--cafe-hero-emphasis-color)",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {tag}
            </Paper>
          ))}
        </Group>
      )}

      {menuPhotoItems.length > 1 && (
        <Group
          className="horizontal-scroll-modern"
          wrap="nowrap"
          gap={8}
          py="sm"
          style={{
            overflowX: "auto",
            paddingInline: "var(--page-edge-padding)",
          }}
        >
          {menuPhotoItems.map((photo, index) => (
            <Paper
              key={photo.id}
              withBorder
              radius="md"
              onClick={() => onSelectMenuPhoto(index)}
              style={{
                width: 108,
                minWidth: 108,
                height: 78,
                overflow: "hidden",
                border:
                  index === menuActiveIndex
                    ? "1px solid var(--color-brand-accent)"
                    : "1px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer",
                transform: index === menuActiveIndex ? "translateY(-1px)" : "none",
                transition: "border-color 160ms ease, transform 160ms ease",
              }}
            >
              <img
                src={photo.url}
                srcSet={buildCafePhotoSrcSet(photo.url, [320, 640])}
                sizes={menuThumbSizes}
                alt={`Меню: ${cafe.name}`}
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

      <Box py="md" style={{ paddingInline: "var(--page-edge-padding)" }}>
        {menuPhotoItems.length === 0 && specificTags.length === 0 && (
          <Text size="sm" c="dimmed">
            После добавления фото и отзывов здесь появятся позиции и теги меню.
          </Text>
        )}
        {onManagePhotos && (
          <Group justify="center" mt={menuPhotoItems.length === 0 ? "xs" : 0}>
            <Button
              size="sm"
              radius="xl"
              variant="default"
              aria-label="Фото меню"
              onClick={() => onManagePhotos("menu")}
              leftSection={<IconCamera size={16} />}
              rightSection={<IconPlus size={14} />}
              styles={{
                root: {
                  borderRadius: 999,
                  border: "1px solid color-mix(in srgb, var(--accent) 46%, var(--glass-border))",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 66%, var(--surface)), color-mix(in srgb, var(--glass-grad-1) 88%, var(--surface)))",
                  color: "var(--cafe-hero-emphasis-color)",
                  boxShadow:
                    "0 10px 24px color-mix(in srgb, var(--color-brand-accent-soft) 58%, transparent)",
                  backdropFilter: "blur(12px) saturate(150%)",
                  WebkitBackdropFilter: "blur(12px) saturate(150%)",
                  paddingInline: 14,
                },
                inner: { gap: 8 },
                label: { fontWeight: 700, letterSpacing: "0.01em" },
              }}
            >
              Добавить фото
            </Button>
          </Group>
        )}
      </Box>
    </Stack>
  );
}
