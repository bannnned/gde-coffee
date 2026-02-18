import { ActionIcon, Box, Group, Paper, Stack, Text } from "@mantine/core";
import { IconCamera, IconPlus } from "@tabler/icons-react";

import type { Cafe, CafePhoto } from "../../../../../entities/cafe/model/types";
import {
  buildCafePhotoPictureSources,
  buildCafePhotoSrcSet,
} from "../../../../../utils/cafePhotoVariants";

type MenuSectionProps = {
  cafe: Cafe;
  menuMainPhoto: CafePhoto | null;
  menuPhotoItems: CafePhoto[];
  menuActiveIndex: number;
  menuImageReady: boolean;
  onOpenViewer: () => void;
  onMenuMainPhotoLoad: (src: string) => void;
  onMenuMainPhotoError: () => void;
  onSelectMenuPhoto: (index: number) => void;
  onManagePhotos?: (kind: "cafe" | "menu") => void;
};

export default function MenuSection({
  cafe,
  menuMainPhoto,
  menuPhotoItems,
  menuActiveIndex,
  menuImageReady,
  onOpenViewer,
  onMenuMainPhotoLoad,
  onMenuMainPhotoError,
  onSelectMenuPhoto,
  onManagePhotos,
}: MenuSectionProps) {
  const menuMainSources = buildCafePhotoPictureSources(menuMainPhoto?.url, [640, 1024, 1536]);
  const menuThumbSizes = "108px";

  return (
    <Stack gap={0}>
      {menuMainPhoto && (
        <Box
          onClick={onOpenViewer}
          style={{
            overflow: "hidden",
            cursor: "pointer",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
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
      )}

      {menuPhotoItems.length > 1 && (
        <Group
          wrap="nowrap"
          gap={8}
          px="md"
          py="sm"
          style={{ overflowX: "auto", borderBottom: "1px solid var(--border)" }}
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

      <Box px="md" py="md">
        {menuPhotoItems.length === 0 && (
          <Text size="sm" c="dimmed">
            Фото меню и позиций
          </Text>
        )}
        {onManagePhotos && (
          <Group justify="center" mt={menuPhotoItems.length === 0 ? "xs" : 0}>
            <ActionIcon
              size="xl"
              radius="xl"
              variant="default"
              aria-label="Фото меню"
              onClick={() => onManagePhotos("menu")}
              styles={{
                root: {
                  border: "1px solid var(--glass-border)",
                  background: "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
                  boxShadow: "var(--glass-shadow)",
                  backdropFilter: "blur(12px) saturate(140%)",
                  WebkitBackdropFilter: "blur(12px) saturate(140%)",
                },
              }}
            >
              <Group gap={2} wrap="nowrap">
                <IconCamera size={16} />
                <IconPlus size={14} />
              </Group>
            </ActionIcon>
          </Group>
        )}
      </Box>
    </Stack>
  );
}
