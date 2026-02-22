import {
  ActionIcon,
  Chip,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Button,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useMemo, useState } from "react";
import { IconMapPin, IconPlus } from "@tabler/icons-react";

import { DISCOVERY_UI_TEXT } from "../../constants";
import {
  createDiscoveryAmenityChipLabelStyles,
  getDiscoveryGlassButtonStyles,
  discoveryGlassSelectStyles,
} from "../styles/glass";

type LocationOption = {
  id: string;
  label: string;
};

type SettingsDrawerProps = {
  opened: boolean;
  onClose: () => void;
  radiusM: number;
  onRadiusChange: (value: number) => void;
  isRadiusLocked?: boolean;
  locationLabel: string;
  locationOptions: LocationOption[];
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
  onOpenMapPicker: () => void;
  highlightLocationBlock?: boolean;
  onSuggestCafe?: () => void;
  popularTags: string[];
  topTags: string[];
  topTagsOptions: string[];
  topTagsQuery: string;
  topTagsOptionsLoading?: boolean;
  topTagsLoading?: boolean;
  topTagsSaving?: boolean;
  topTagsError?: string | null;
  topTagsDirty?: boolean;
  isAuthed: boolean;
  onTopTagsChange: (next: string[]) => void;
  onTopTagsQueryChange: (value: string) => void;
  onSaveTopTags: () => void;
};

const RADIUS_OPTIONS = [1000, 2500, 5000, 0] as const;

export default function SettingsDrawer({
  opened,
  onClose,
  radiusM,
  onRadiusChange,
  isRadiusLocked = false,
  locationLabel,
  locationOptions,
  selectedLocationId,
  onSelectLocation,
  onOpenMapPicker,
  highlightLocationBlock = false,
  onSuggestCafe,
  popularTags,
  topTags,
  topTagsOptions,
  topTagsQuery,
  topTagsOptionsLoading = false,
  topTagsLoading = false,
  topTagsSaving = false,
  topTagsError = null,
  topTagsDirty = false,
  isAuthed,
  onTopTagsChange,
  onTopTagsQueryChange,
  onSaveTopTags,
}: SettingsDrawerProps) {
  const theme = useMantineTheme();
  const isCoarsePointer = useMediaQuery("(pointer: coarse)") ?? false;
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [pendingTagToAdd, setPendingTagToAdd] = useState<string | null>(null);

  const drawerStyles = {
    content: {
      background: "var(--glass-bg)",
      backdropFilter: "blur(18px) saturate(180%)",
      WebkitBackdropFilter: "blur(18px) saturate(180%)",
      borderRadius: 0,
      height: "100dvh",
      maxHeight: "100dvh",
      border: "1px solid var(--glass-border)",
      boxShadow: "var(--shadow)",
    },
    header: {
      position: "sticky",
      top: 0,
      zIndex: 8,
      background: "color-mix(in srgb, var(--glass-bg) 88%, transparent)",
      backdropFilter: "blur(20px) saturate(170%)",
      WebkitBackdropFilter: "blur(20px) saturate(170%)",
      borderBottom: "1px solid var(--glass-border)",
    },
    body: {
      paddingTop: theme.spacing.sm,
    },
    overlay: {
      backdropFilter: "blur(10px)",
      backgroundColor: "var(--color-surface-overlay-strong)",
    },
  } as const;
  const tagChipLabelStyles = createDiscoveryAmenityChipLabelStyles(theme.fontSizes.xs);
  const popularTopTags = useMemo(() => {
    const merged = [...topTagsOptions, ...popularTags];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of merged) {
      const value = raw.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(value);
      if (unique.length >= 5) break;
    }
    return unique;
  }, [popularTags, topTagsOptions]);

  const normalizedSelectedTags = useMemo(
    () => topTags.map((tag) => tag.trim()).filter((tag) => tag !== ""),
    [topTags],
  );

  const hasTagSelected = (tag: string) => {
    const key = tag.trim().toLowerCase();
    return normalizedSelectedTags.some((value) => value.toLowerCase() === key);
  };

  const canEditTags = isAuthed && !topTagsLoading && !topTagsSaving;

  const toggleTag = (tag: string) => {
    if (!canEditTags) return;
    const value = tag.trim();
    if (!value) return;
    if (hasTagSelected(value)) {
      onTopTagsChange(
        normalizedSelectedTags.filter((item) => item.toLowerCase() !== value.toLowerCase()),
      );
      return;
    }
    if (normalizedSelectedTags.length >= 12) return;
    onTopTagsChange([...normalizedSelectedTags, value]);
  };

  const handleAddPendingTag = () => {
    if (!canEditTags) return;
    const value = (pendingTagToAdd ?? "").trim();
    if (!value) return;
    if (hasTagSelected(value) || normalizedSelectedTags.length >= 12) {
      setPendingTagToAdd(null);
      return;
    }
    onTopTagsChange([...normalizedSelectedTags, value]);
    setPendingTagToAdd(null);
    onTopTagsQueryChange("");
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="100%"
      title="Настройки"
      styles={drawerStyles}
    >
      <Stack gap="md">
        <Stack
          gap="xs"
          style={
            highlightLocationBlock
              ? {
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid var(--attention-ring)",
                  boxShadow: "0 0 20px var(--attention-glow)",
                  background: "var(--color-brand-accent-soft)",
                }
              : undefined
          }
        >
          <Group justify="space-between" align="center">
            <Text>Место</Text>
            <Text size="sm" c="dimmed">
              {locationLabel}
            </Text>
          </Group>
          <Select
            data={locationOptions.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
            value={selectedLocationId || null}
            placeholder="Выбрать город"
            searchable={!isCoarsePointer}
            nothingFoundMessage="Ничего не найдено"
            onChange={(value) => {
              if (!value) return;
              onSelectLocation(value);
            }}
            comboboxProps={{ withinPortal: false }}
            styles={discoveryGlassSelectStyles}
          />
          <Button
            variant="light"
            leftSection={<IconMapPin size={16} />}
            onClick={onOpenMapPicker}
            styles={getDiscoveryGlassButtonStyles(false)}
          >
            Выбрать вручную на карте
          </Button>
        </Stack>

        <Stack gap="xs">
          <Text>Контент</Text>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={onSuggestCafe}
            styles={getDiscoveryGlassButtonStyles(false)}
          >
            Предложить кофейню
          </Button>
        </Stack>

        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text>Теги на главной</Text>
            <ActionIcon
              variant="transparent"
              size={34}
              aria-label="Добавить тег"
              styles={{
                root: {
                  borderRadius: 999,
                  border: "1px solid var(--glass-border)",
                  background: "var(--glass-bg-soft)",
                },
              }}
              onClick={() => {
                if (!isAuthed) return;
                setIsTagPickerOpen((prev) => !prev);
              }}
              disabled={!isAuthed}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Group>
          <Text size="sm" c="dimmed">
            Топ‑5 популярных тегов рядом
          </Text>
          <Group gap={6} wrap="wrap">
            {popularTopTags.length > 0 ? (
              popularTopTags.map((tag) => {
                const isChecked = hasTagSelected(tag);
                return (
                  <Chip
                    key={tag}
                    checked={isChecked}
                    onChange={() => toggleTag(tag)}
                    size="xs"
                    radius="xl"
                    variant="filled"
                    icon={null}
                    disabled={!canEditTags}
                    styles={{
                      iconWrapper: { display: "none" },
                      label: {
                        ...tagChipLabelStyles.base,
                        ...(isChecked ? tagChipLabelStyles.checked : null),
                      },
                    }}
                  >
                    {tag}
                  </Chip>
                );
              })
            ) : (
              <Text size="sm" c="dimmed">
                Пока нет популярных тегов в этой области.
              </Text>
            )}
          </Group>
          {!isAuthed ? (
            <Text size="sm" c="dimmed">
              Войдите в аккаунт, чтобы выбрать любимые теги.
            </Text>
          ) : (
            <>
              {isTagPickerOpen && (
                <Stack gap={6}>
                  <Group grow align="flex-end">
                    <Select
                      data={topTagsOptions.map((tag) => ({ value: tag, label: tag }))}
                      value={pendingTagToAdd}
                      searchable
                      clearable
                      placeholder="Найти существующий тег"
                      nothingFoundMessage="Тег не найден"
                      searchValue={topTagsQuery}
                      onSearchChange={onTopTagsQueryChange}
                      onChange={setPendingTagToAdd}
                      comboboxProps={{ withinPortal: false }}
                      rightSection={topTagsOptionsLoading ? <Text size="xs">...</Text> : null}
                      styles={discoveryGlassSelectStyles}
                      disabled={!canEditTags}
                    />
                    <Button
                      variant="light"
                      onClick={handleAddPendingTag}
                      disabled={!pendingTagToAdd || !canEditTags}
                      styles={getDiscoveryGlassButtonStyles(Boolean(pendingTagToAdd))}
                    >
                      Добавить
                    </Button>
                  </Group>
                </Stack>
              )}
              <Text size="sm" c="dimmed">
                Выбрано: {normalizedSelectedTags.length}/12
              </Text>
              <Group gap={6} wrap="wrap">
                {normalizedSelectedTags.length > 0 ? (
                  normalizedSelectedTags.map((tag) => (
                    <Chip
                      key={tag}
                      checked
                      onChange={() => toggleTag(tag)}
                      size="xs"
                      radius="xl"
                      variant="filled"
                      icon={null}
                      disabled={!canEditTags}
                      styles={{
                        iconWrapper: { display: "none" },
                        label: tagChipLabelStyles.checked,
                      }}
                    >
                      {tag}
                    </Chip>
                  ))
                ) : (
                  <Text size="sm" c="dimmed">
                    Добавьте теги через кнопку +
                  </Text>
                )}
              </Group>
              <Button
                variant="light"
                onClick={onSaveTopTags}
                disabled={!topTagsDirty || topTagsSaving || topTagsLoading}
                loading={topTagsSaving}
                styles={getDiscoveryGlassButtonStyles(Boolean(topTagsDirty))}
              >
                Сохранить теги
              </Button>
              {topTagsError && (
                <Text size="sm" c="red">
                  {topTagsError}
                </Text>
              )}
            </>
          )}
        </Stack>

        <Group justify="space-between">
          <Text>{DISCOVERY_UI_TEXT.radiusTitle}</Text>
          {isRadiusLocked && (
            <Text size="xs" c="dimmed">
              Фиксирован по городу
            </Text>
          )}
          <Group gap="xs">
            {RADIUS_OPTIONS.map((value) => (
              <Button
                key={value}
                variant="transparent"
                size="xs"
                styles={getDiscoveryGlassButtonStyles(
                  isRadiusLocked ? value === 0 : radiusM === value,
                )}
                onClick={() => {
                  if (isRadiusLocked) return;
                  onRadiusChange(value);
                }}
                disabled={isRadiusLocked}
              >
                {value === 0
                  ? DISCOVERY_UI_TEXT.radiusAll
                  : `${value / 1000}${value === 2500 ? "2.5" : ""}`.includes(
                        "2.5",
                      )
                    ? "2.5 км"
                    : `${value / 1000} км`}
              </Button>
            ))}
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
