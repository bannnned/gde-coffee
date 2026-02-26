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
import { useEffect, useMemo, useRef, useState } from "react";
import { IconMapPin, IconPlus } from "@tabler/icons-react";

import { DISCOVERY_UI_TEXT } from "../../constants";
import {
  createDiscoveryAmenityChipLabelStyles,
  discoveryGlassActionIconStyles,
  getDiscoveryGlassButtonStyles,
  getDiscoveryRadiusPresetButtonStyles,
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
  onRequireAuthForTags?: () => void;
  onTopTagsChange: (next: string[]) => void;
  onTopTagsQueryChange: (value: string) => void;
  onSaveTopTags: () => void;
};

const RADIUS_OPTIONS = [1000, 2500, 5000, 0] as const;

function formatRadiusLabel(value: (typeof RADIUS_OPTIONS)[number]) {
  if (value === 0) return DISCOVERY_UI_TEXT.radiusAll;
  if (value === 2500) return "2.5 км";
  return `${value / 1000} км`;
}

export default function SettingsDrawer({
  opened,
  onClose,
  radiusM,
  onRadiusChange,
  locationLabel,
  locationOptions,
  selectedLocationId,
  onSelectLocation,
  onOpenMapPicker,
  highlightLocationBlock = false,
  onSuggestCafe,
  popularTags = [],
  topTags = [],
  topTagsOptions = [],
  topTagsQuery = "",
  topTagsOptionsLoading = false,
  topTagsLoading = false,
  topTagsSaving = false,
  topTagsError = null,
  topTagsDirty = false,
  isAuthed,
  onRequireAuthForTags,
  onTopTagsChange,
  onTopTagsQueryChange,
  onSaveTopTags,
}: SettingsDrawerProps) {
  const theme = useMantineTheme();
  const isCoarsePointer = useMediaQuery("(pointer: coarse)") ?? false;
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [pendingTagToAdd, setPendingTagToAdd] = useState<string | null>(null);
  const [tagSaveFeedback, setTagSaveFeedback] = useState<string | null>(null);
  const prevTopTagsSavingRef = useRef(topTagsSaving);

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
  const normalizedSelectedTags = useMemo(() => {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of topTags) {
      const value = raw.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(value);
      if (unique.length >= 12) break;
    }
    return unique;
  }, [topTags]);

  const selectedSet = useMemo(
    () => new Set(normalizedSelectedTags.map((tag) => tag.toLowerCase())),
    [normalizedSelectedTags],
  );

  const normalizedTagOptions = useMemo(() => {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of topTagsOptions) {
      const value = raw.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(value);
      if (unique.length >= 60) break;
    }
    return unique;
  }, [topTagsOptions]);

  const normalizedTagOptionsSet = useMemo(
    () => new Set(normalizedTagOptions.map((tag) => tag.toLowerCase())),
    [normalizedTagOptions],
  );

  const popularTopTags = useMemo(() => {
    const merged = [...popularTags, ...normalizedTagOptions];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of merged) {
      const value = raw.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key) || selectedSet.has(key)) continue;
      seen.add(key);
      unique.push(value);
      if (unique.length >= 5) break;
    }
    return unique;
  }, [popularTags, selectedSet, normalizedTagOptions]);

  const hasTagSelected = (tag: string) => {
    const key = tag.trim().toLowerCase();
    return normalizedSelectedTags.some((value) => value.toLowerCase() === key);
  };

  const canEditTags = isAuthed && !topTagsLoading && !topTagsSaving;
  const baseSectionStyles = {
    padding: 12,
    borderRadius: 16,
    border: "1px solid var(--glass-border)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--glass-grad-1) 96%, transparent), color-mix(in srgb, var(--glass-grad-2) 88%, transparent))",
    boxShadow: "0 10px 22px color-mix(in srgb, var(--color-surface-overlay-soft) 54%, transparent)",
    backdropFilter: "blur(14px) saturate(145%)",
    WebkitBackdropFilter: "blur(14px) saturate(145%)",
  } as const;

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
    if (!normalizedTagOptionsSet.has(value.toLowerCase())) {
      setPendingTagToAdd(null);
      return;
    }
    if (hasTagSelected(value) || normalizedSelectedTags.length >= 12) {
      setPendingTagToAdd(null);
      return;
    }
    onTopTagsChange([...normalizedSelectedTags, value]);
    setPendingTagToAdd(null);
    onTopTagsQueryChange("");
  };

  useEffect(() => {
    const wasSaving = prevTopTagsSavingRef.current;
    prevTopTagsSavingRef.current = topTagsSaving;
    if (!wasSaving || topTagsSaving) return undefined;

    if (!topTagsError && !topTagsDirty) {
      setTagSaveFeedback("Сохранено");
      const timer = window.setTimeout(() => {
        setTagSaveFeedback(null);
      }, 2200);
      return () => {
        window.clearTimeout(timer);
      };
    }

    return undefined;
  }, [topTagsDirty, topTagsError, topTagsSaving]);

  useEffect(() => {
    if (topTagsDirty) {
      setTagSaveFeedback(null);
    }
  }, [topTagsDirty]);

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
                  ...baseSectionStyles,
                  border: "1px solid var(--attention-ring)",
                  boxShadow:
                    "0 0 0 1px var(--attention-ring), 0 0 20px var(--attention-glow)",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--color-brand-accent-soft) 78%, var(--glass-grad-1)), color-mix(in srgb, var(--glass-grad-2) 82%, transparent))",
                }
              : baseSectionStyles
          }
        >
          <Group justify="space-between" align="flex-start" gap="xs">
            <Text fw={700}>1. Где искать</Text>
            <Text size="xs" c="dimmed" ta="right" lineClamp={2}>
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
            comboboxProps={{ withinPortal: true, zIndex: 4300 }}
            styles={discoveryGlassSelectStyles}
          />
          <Button
            variant="light"
            leftSection={<IconMapPin size={16} />}
            onClick={onOpenMapPicker}
            styles={getDiscoveryGlassButtonStyles(false)}
          >
            Выбрать точку на карте
          </Button>
        </Stack>

        <Stack gap="sm" style={baseSectionStyles}>
          <Text fw={700}>2. Фильтрация</Text>

          <Stack gap={6}>
            <Text size="sm" fw={600}>
              {DISCOVERY_UI_TEXT.radiusTitle}
            </Text>
            <Group gap="xs" wrap="wrap">
              {RADIUS_OPTIONS.map((value) => (
                <Button
                  key={value}
                  variant="filled"
                  size="xs"
                  styles={getDiscoveryRadiusPresetButtonStyles(radiusM === value)}
                  onClick={() => onRadiusChange(value)}
                >
                  {formatRadiusLabel(value)}
                </Button>
              ))}
            </Group>
          </Stack>

          <Stack gap={6}>
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Теги на главной
              </Text>
              <ActionIcon
                variant="filled"
                size={32}
                aria-label="Добавить тег"
                styles={discoveryGlassActionIconStyles}
                onClick={() => {
                  if (!isAuthed) {
                    onRequireAuthForTags?.();
                    return;
                  }
                  setIsTagPickerOpen((prev) => !prev);
                }}
              >
                <IconPlus size={16} />
              </ActionIcon>
            </Group>

            {topTagsLoading && (
              <Text size="sm" c="dimmed">
                Загружаем теги...
              </Text>
            )}

            <Text size="sm" c="dimmed">
              Популярные теги для вашего контекста
            </Text>
            <Group gap={6} wrap="wrap">
              {popularTopTags.length > 0 ? (
                popularTopTags.map((tag) => {
                  const isChecked = hasTagSelected(tag);
                  return (
                    <Chip
                      key={tag}
                      checked={isChecked}
                      onChange={() => {
                        if (!isAuthed) {
                          onRequireAuthForTags?.();
                          return;
                        }
                        toggleTag(tag);
                      }}
                      size="xs"
                      radius="xl"
                      variant="filled"
                      icon={null}
                      disabled={isAuthed ? !canEditTags : false}
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
              <Stack gap={6}>
                <Text size="sm" c="dimmed">
                  Войдите в аккаунт, чтобы выбрать любимые теги.
                </Text>
                <Button
                  variant="light"
                  onClick={() => onRequireAuthForTags?.()}
                  styles={getDiscoveryGlassButtonStyles(true)}
                >
                  Войти и настроить теги
                </Button>
              </Stack>
            ) : (
              <>
                {isTagPickerOpen && (
                  <Stack gap={6}>
                    <Group grow align="flex-end">
                      <Select
                        data={normalizedTagOptions.map((tag) => ({ value: tag, label: tag }))}
                        value={pendingTagToAdd}
                        searchable
                        clearable
                        placeholder="Найти существующий тег"
                        nothingFoundMessage="Тег не найден"
                        searchValue={topTagsQuery}
                        onSearchChange={onTopTagsQueryChange}
                        onChange={setPendingTagToAdd}
                        comboboxProps={{ withinPortal: true, zIndex: 4300 }}
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
                {tagSaveFeedback && !topTagsError && (
                  <Text size="sm" c="teal">
                    {tagSaveFeedback}
                  </Text>
                )}
                {topTagsError && (
                  <Text size="sm" c="red">
                    {topTagsError}
                  </Text>
                )}
              </>
            )}
          </Stack>
        </Stack>

        <Stack gap="xs" style={baseSectionStyles}>
          <Text fw={700}>3. Контент</Text>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={onSuggestCafe}
            disabled={!onSuggestCafe}
            styles={getDiscoveryGlassButtonStyles(false)}
          >
            Предложить кофейню
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
