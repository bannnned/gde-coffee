import { ActionIcon, Badge, Box, Button, Group, Paper, Stack, Text, Textarea } from "@mantine/core";
import { IconCamera, IconPlus } from "@tabler/icons-react";
import type { ReactNode } from "react";

import type { Cafe, CafePhoto } from "../../../../../entities/cafe/model/types";
import {
  buildCafePhotoPictureSources,
  buildCafePhotoSrcSet,
} from "../../../../../utils/cafePhotoVariants";
import { AMENITY_LABELS } from "../../../constants";
import { formatDistance } from "../../../utils";

type AboutSectionProps = {
  cafe: Cafe;
  aboutMainPhoto: CafePhoto | null;
  aboutPhotoItems: CafePhoto[];
  aboutActiveIndex: number;
  aboutImageReady: boolean;
  onOpenViewer: () => void;
  onAboutMainPhotoLoad: (src: string) => void;
  onAboutMainPhotoError: () => void;
  onSelectAboutPhoto: (index: number) => void;
  ratingPanel: ReactNode;
  showDistance: boolean;
  showRoutes: boolean;
  onOpen2gis?: () => void;
  onOpenYandex?: () => void;
  descriptionEditing: boolean;
  description: string;
  descriptionDraft: string;
  descriptionSaving: boolean;
  descriptionError: string | null;
  descriptionHint: string | null;
  descriptionActionLabel: string;
  canManageDirectly: boolean;
  onDescriptionDraftChange: (value: string) => void;
  onStartDescription: () => void;
  onCancelDescription: () => void;
  onSaveDescription: () => void;
  onManagePhotos?: (kind: "cafe" | "menu") => void;
  canSaveDescription: boolean;
  badgeStyles: any;
};

export default function AboutSection({
  cafe,
  aboutMainPhoto,
  aboutPhotoItems,
  aboutActiveIndex,
  aboutImageReady,
  onOpenViewer,
  onAboutMainPhotoLoad,
  onAboutMainPhotoError,
  onSelectAboutPhoto,
  ratingPanel,
  showDistance,
  showRoutes,
  onOpen2gis,
  onOpenYandex,
  descriptionEditing,
  description,
  descriptionDraft,
  descriptionSaving,
  descriptionError,
  descriptionHint,
  descriptionActionLabel,
  canManageDirectly,
  onDescriptionDraftChange,
  onStartDescription,
  onCancelDescription,
  onSaveDescription,
  onManagePhotos,
  canSaveDescription,
  badgeStyles,
}: AboutSectionProps) {
  const aboutMainSources = buildCafePhotoPictureSources(aboutMainPhoto?.url, [640, 1024, 1536]);
  const aboutThumbSizes = "108px";

  return (
    <Stack gap={0}>
      {aboutMainPhoto && (
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
            {aboutMainSources.avifSrcSet && (
              <source
                type="image/avif"
                srcSet={aboutMainSources.avifSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            {aboutMainSources.webpSrcSet && (
              <source
                type="image/webp"
                srcSet={aboutMainSources.webpSrcSet}
                sizes="(max-width: 768px) 100vw, 960px"
              />
            )}
            <img
              src={aboutMainPhoto.url}
              srcSet={aboutMainSources.fallbackSrcSet}
              sizes="(max-width: 768px) 100vw, 960px"
              alt={`Фото: ${cafe.name}`}
              onLoad={(event) => onAboutMainPhotoLoad(event.currentTarget.currentSrc || event.currentTarget.src)}
              onError={onAboutMainPhotoError}
              style={{
                width: "100%",
                height: 260,
                objectFit: "cover",
                display: "block",
                opacity: aboutImageReady ? 1 : 0.38,
                filter: aboutImageReady ? "blur(0px)" : "blur(2px)",
                transition: "opacity 220ms ease, filter 240ms ease",
              }}
            />
          </picture>
        </Box>
      )}

      {aboutPhotoItems.length > 1 && (
        <Group
          wrap="nowrap"
          gap={8}
          px="md"
          py="sm"
          style={{ overflowX: "auto", borderBottom: "1px solid var(--border)" }}
        >
          {aboutPhotoItems.map((photo, index) => (
            <Paper
              key={photo.id}
              withBorder
              radius="md"
              onClick={() => onSelectAboutPhoto(index)}
              style={{
                width: 108,
                minWidth: 108,
                height: 78,
                overflow: "hidden",
                border:
                  index === aboutActiveIndex
                    ? "1px solid var(--color-brand-accent)"
                    : "1px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer",
                transform: index === aboutActiveIndex ? "translateY(-1px)" : "none",
                transition: "border-color 160ms ease, transform 160ms ease",
              }}
            >
              <img
                src={photo.url}
                srcSet={buildCafePhotoSrcSet(photo.url, [320, 640])}
                sizes={aboutThumbSizes}
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

      <Stack gap="xs" px="md" py="md">
        {ratingPanel}

        <Text c="dimmed" size="sm">
          {cafe.address}
        </Text>
        {showDistance && <Text size="sm">{formatDistance(cafe.distance_m)}</Text>}

        {descriptionEditing ? (
          <Stack gap="xs">
            <Textarea
              value={descriptionDraft}
              onChange={(event) => onDescriptionDraftChange(event.currentTarget.value)}
              placeholder="Опишите атмосферу, меню или особенности места"
              autosize
              minRows={3}
              maxRows={6}
            />
            {descriptionError && (
              <Text size="xs" c="red">
                {descriptionError}
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={onCancelDescription} disabled={descriptionSaving}>
                Отмена
              </Button>
              <Button onClick={onSaveDescription} loading={descriptionSaving}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        ) : (
          <>
            {description ? (
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {description}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                Описание пока не добавлено.
              </Text>
            )}
            {canManageDirectly && (
              <Button variant="subtle" onClick={onStartDescription} disabled={!canSaveDescription}>
                {descriptionActionLabel}
              </Button>
            )}
          </>
        )}

        {canManageDirectly && descriptionHint && (
          <Text size="sm" c="teal.6">
            {descriptionHint}
          </Text>
        )}

        {cafe.amenities.length > 0 && (
          <Group gap={6} wrap="wrap">
            {cafe.amenities.map((a) => (
              <Badge key={a} variant="light" styles={badgeStyles}>
                {AMENITY_LABELS[a] ?? a}
              </Badge>
            ))}
          </Group>
        )}
        {showRoutes && (onOpen2gis || onOpenYandex) && (
          <Group mt="xs" grow>
            {onOpen2gis && <Button onClick={onOpen2gis}>2GIS</Button>}
            {onOpenYandex && (
              <Button variant="light" onClick={onOpenYandex}>
                Яндекс
              </Button>
            )}
          </Group>
        )}
        {onManagePhotos && (
          <ActionIcon
            mt="xs"
            size="xl"
            radius="xl"
            variant="default"
            aria-label="Фото места"
            onClick={() => onManagePhotos("cafe")}
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
        )}
      </Stack>
    </Stack>
  );
}
