import { IconX } from "@tabler/icons-react";
import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "../../lib/utils";

type TagsInputStyles = {
  input?: CSSProperties;
};

export type TagsInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  data?: string[];
  maxTags?: number;
  splitChars?: string[];
  placeholder?: string;
  clearable?: boolean;
  searchable?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: ReactNode;
  styles?: TagsInputStyles;
  className?: string;
  nothingFoundMessage?: string;
  onSearchChange?: (value: string) => void;
};

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ");
}

export function TagsInput({
  value,
  onChange,
  data = [],
  maxTags = 10,
  splitChars = [","],
  placeholder = "Добавить тег",
  clearable = false,
  searchable = true,
  required = false,
  disabled = false,
  error,
  styles,
  className,
  nothingFoundMessage = "Ничего не найдено",
  onSearchChange,
}: TagsInputProps) {
  const [query, setQuery] = useState("");
  const normalizedSelected = useMemo(() => {
    const dedup = new Set<string>();
    const result: string[] = [];
    for (const raw of value) {
      const normalized = normalizeTag(raw);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (dedup.has(key)) continue;
      dedup.add(key);
      result.push(normalized);
      if (result.length >= maxTags) break;
    }
    return result;
  }, [maxTags, value]);

  const normalizedData = useMemo(() => {
    const dedup = new Set<string>();
    const options: string[] = [];
    for (const item of data) {
      const normalized = normalizeTag(item);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (dedup.has(key)) continue;
      dedup.add(key);
      options.push(normalized);
    }
    return options;
  }, [data]);

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!searchable) return [];
    const selectedKeys = new Set(normalizedSelected.map((item) => item.toLowerCase()));
    if (!normalizedQuery) {
      return normalizedData.filter((item) => !selectedKeys.has(item.toLowerCase())).slice(0, 8);
    }
    return normalizedData
      .filter((item) => item.toLowerCase().includes(normalizedQuery) && !selectedKeys.has(item.toLowerCase()))
      .slice(0, 8);
  }, [normalizedData, normalizedQuery, normalizedSelected, searchable]);

  const commitValue = (next: string[]) => {
    onChange(next.slice(0, maxTags));
  };

  const addTag = (raw: string): boolean => {
    const tag = normalizeTag(raw);
    if (!tag) return false;
    if (normalizedSelected.length >= maxTags) return false;
    const key = tag.toLowerCase();
    if (normalizedSelected.some((item) => item.toLowerCase() === key)) return false;
    commitValue([...normalizedSelected, tag]);
    return true;
  };

  const removeTag = (raw: string) => {
    const key = raw.toLowerCase();
    commitValue(normalizedSelected.filter((item) => item.toLowerCase() !== key));
  };

  const clearAll = () => {
    commitValue([]);
    setQuery("");
    onSearchChange?.("");
  };

  const tryCommitQuery = () => {
    const current = query;
    if (!current.trim()) return;
    const chunks = splitChars.reduce<string[]>(
      (acc, splitter) => acc.flatMap((part) => part.split(splitter)),
      [current],
    );
    const working = [...normalizedSelected];
    const selectedKeys = new Set(working.map((item) => item.toLowerCase()));
    for (const chunk of chunks) {
      const tag = normalizeTag(chunk);
      if (!tag) continue;
      if (working.length >= maxTags) break;
      const key = tag.toLowerCase();
      if (selectedKeys.has(key)) continue;
      selectedKeys.add(key);
      working.push(tag);
    }
    if (working.length === normalizedSelected.length) {
      const added = addTag(current);
      if (!added) return;
    } else {
      commitValue(working);
    }
    setQuery("");
    onSearchChange?.("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || splitChars.includes(event.key)) {
      event.preventDefault();
      tryCommitQuery();
      return;
    }
    if (event.key === "Backspace" && query.length === 0 && normalizedSelected.length > 0) {
      removeTag(normalizedSelected[normalizedSelected.length - 1]);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 shadow-surface ui-focus-ring",
          disabled ? "opacity-50" : "",
          error ? "border-danger" : "",
        )}
        style={styles?.input}
      >
        {normalizedSelected.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-brand-accent)] bg-[color:var(--color-brand-accent-soft)] px-2 py-0.5 text-xs font-medium text-text"
          >
            {tag}
            {!disabled ? (
              <button
                type="button"
                aria-label={`Удалить тег ${tag}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full ui-focus-ring"
                onClick={() => removeTag(tag)}
              >
                <IconX size={12} />
              </button>
            ) : null}
          </span>
        ))}
        <input
          value={query}
          placeholder={normalizedSelected.length === 0 ? placeholder : ""}
          required={required && normalizedSelected.length === 0}
          disabled={disabled || normalizedSelected.length >= maxTags}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setQuery(next);
            onSearchChange?.(next);
          }}
          onBlur={() => {
            if (!query.trim()) return;
            tryCommitQuery();
          }}
          onKeyDown={handleKeyDown}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-text placeholder:text-muted outline-none"
        />
        {clearable && normalizedSelected.length > 0 && !disabled ? (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Очистить все теги"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted ui-focus-ring"
          >
            <IconX size={14} />
          </button>
        ) : null}
      </div>

      {searchable && query.trim().length > 0 ? (
        <div className="rounded-[12px] border border-border bg-surface p-1 shadow-surface">
          {suggestions.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted">{nothingFoundMessage}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    addTag(item);
                    setQuery("");
                    onSearchChange?.("");
                  }}
                  className="rounded-full border border-border bg-card px-2 py-1 text-xs text-text transition ui-interactive ui-focus-ring"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {typeof error === "string" && error.length > 0 ? (
        <p className="text-xs text-danger">{error}</p>
      ) : null}
    </div>
  );
}
