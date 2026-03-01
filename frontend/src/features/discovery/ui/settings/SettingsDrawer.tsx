import { useEffect, useMemo, useRef, useState } from "react";
import { IconMapPin, IconPlus } from "@tabler/icons-react";

import { Button, Select } from "../../../../components/ui";
import { cn } from "../../../../lib/utils";
import { DISCOVERY_UI_TEXT } from "../../constants";
import { AppSheet, FormActions, FormField } from "../../../../ui/bridge";
import {
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
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [pendingTagToAdd, setPendingTagToAdd] = useState<string | null>(null);
  const [pendingLocationId, setPendingLocationId] = useState<string>("");
  const [tagSaveFeedback, setTagSaveFeedback] = useState<string | null>(null);
  const prevTopTagsSavingRef = useRef(topTagsSaving);
  const normalizedSelectedLocationId =
    typeof selectedLocationId === "string" ? selectedLocationId.trim() : "";
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

  useEffect(() => {
    setPendingLocationId(normalizedSelectedLocationId);
  }, [normalizedSelectedLocationId, opened]);

  return (
    <AppSheet
      open={opened}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Настройки"
      implementation="radix"
      contentClassName="bg-glass border border-glass-border shadow-glass backdrop-blur-[18px] backdrop-saturate-[180%]"
      bodyClassName="px-4 pt-4 pb-6"
    >
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "flex flex-col gap-2",
            highlightLocationBlock &&
              "rounded-[14px] border border-[var(--attention-ring)] p-3 shadow-[0_0_0_1px_var(--attention-ring),0_0_20px_var(--attention-glow)]",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-right text-xs text-[var(--muted)]">
              {locationLabel}
            </p>
          </div>
          <FormField label="Город">
            <div className="relative">
              <select
                value={pendingLocationId}
                onChange={(event) => {
                  const nextId = event.currentTarget.value.trim();
                  setPendingLocationId(nextId);
                  if (!nextId) return;
                  onSelectLocation(nextId);
                }}
                className="h-10 w-full rounded-[12px] border px-3 pr-9 text-sm font-medium text-[var(--text)] outline-none ui-focus-ring"
                style={{
                  borderColor: "var(--glass-border)",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 82%, var(--bg)), color-mix(in srgb, var(--surface) 72%, var(--glass-grad-1)))",
                  boxShadow: "var(--glass-shadow)",
                  backdropFilter: "blur(16px) saturate(180%)",
                  WebkitBackdropFilter: "blur(16px) saturate(180%)",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <option value="" disabled>
                  Выбрать город
                </option>
                {locationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted)]"
              >
                ▾
              </span>
            </div>
          </FormField>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="justify-start gap-2 border-glass-border bg-glass text-text shadow-glass"
            onClick={onOpenMapPicker}
          >
            <IconMapPin size={16} />
            <span>Выбрать точку на карте</span>
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <FormField label={DISCOVERY_UI_TEXT.radiusTitle}>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={radiusM === value ? "default" : "secondary"}
                  size="sm"
                  className={cn(
                    "h-8 rounded-full px-3 text-xs",
                    radiusM === value
                      ? "border-[color:var(--color-brand-accent)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] text-[var(--text)]",
                  )}
                  onClick={() => onRadiusChange(value)}
                >
                  {formatRadiusLabel(value)}
                </Button>
              ))}
            </div>
          </FormField>

          <div className="flex flex-col gap-2">
            <FormField label="Теги на главной">
              <FormActions className="justify-between">
                <p className="text-xs text-[var(--muted)]">Популярные теги для вашего контекста</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Добавить тег"
                  className="h-8 w-8 rounded-full border-glass-border bg-glass text-text shadow-glass"
                  onClick={() => {
                    if (!isAuthed) {
                      onRequireAuthForTags?.();
                      return;
                    }
                    setIsTagPickerOpen((prev) => !prev);
                  }}
                >
                  <IconPlus size={16} />
                </Button>
              </FormActions>
            </FormField>

            {topTagsLoading && (
              <p className="text-sm text-[var(--muted)]">
                Загружаем теги...
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {popularTopTags.length > 0 ? (
                popularTopTags.map((tag) => {
                  const isChecked = hasTagSelected(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (!isAuthed) {
                          onRequireAuthForTags?.();
                          return;
                        }
                        toggleTag(tag);
                      }}
                      disabled={isAuthed ? !canEditTags : false}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition ui-interactive",
                        isChecked
                          ? "border-[color:var(--color-brand-accent)] bg-[color:var(--color-brand-accent-soft)] text-[color:var(--text)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:bg-[color:var(--card)]",
                      )}
                    >
                      {tag}
                    </button>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Пока нет популярных тегов в этой области.
                </p>
              )}
            </div>

            {!isAuthed ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-[var(--muted)]">
                  Войдите в аккаунт, чтобы выбрать любимые теги.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onRequireAuthForTags?.()}
                  className="justify-start border-glass-border bg-glass text-text shadow-glass"
                >
                  Войти и настроить теги
                </Button>
              </div>
            ) : (
              <>
                {isTagPickerOpen && (
                  <div className="flex flex-col gap-1.5">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
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
                        rightSection={topTagsOptionsLoading ? <span style={{ fontSize: 12 }}>...</span> : null}
                        styles={discoveryGlassSelectStyles}
                        disabled={!canEditTags}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddPendingTag}
                        disabled={!pendingTagToAdd || !canEditTags}
                        className="border-glass-border bg-glass text-text shadow-glass"
                      >
                        Добавить
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-[var(--muted)]">
                  Выбрано: {normalizedSelectedTags.length}/12
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {normalizedSelectedTags.length > 0 ? (
                    normalizedSelectedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        disabled={!canEditTags}
                        className="rounded-full border border-[color:var(--color-brand-accent)] bg-[color:var(--color-brand-accent-soft)] px-2.5 py-1 text-xs font-medium text-[color:var(--text)] transition ui-interactive"
                      >
                        {tag}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Добавьте теги через кнопку +
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onSaveTopTags}
                  disabled={!topTagsDirty || topTagsSaving || topTagsLoading}
                  className="justify-start border-glass-border bg-glass text-text shadow-glass"
                >
                  {topTagsSaving ? "Сохраняем..." : "Сохранить теги"}
                </Button>
                {tagSaveFeedback && !topTagsError && (
                  <p className="text-sm text-[var(--color-status-success)]">
                    {tagSaveFeedback}
                  </p>
                )}
                {topTagsError && (
                  <p className="text-sm text-[var(--color-status-error)]">
                    {topTagsError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onSuggestCafe}
            disabled={!onSuggestCafe}
            className="justify-start gap-2 border-glass-border bg-glass text-text shadow-glass"
          >
            <IconPlus size={16} />
            <span>Предложить кофейню</span>
          </Button>
        </div>
      </div>
    </AppSheet>
  );
}
