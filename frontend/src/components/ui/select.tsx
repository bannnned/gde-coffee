import { IconChevronDown, IconX } from "@tabler/icons-react";
import {
  useMemo,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";

import { cn } from "../../lib/utils";

type SelectOptionInput = string | { value: string; label: string; disabled?: boolean };
type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectStyles = {
  input?: CSSProperties;
  dropdown?: CSSProperties;
};

export type SelectProps = {
  value?: string | null;
  data: SelectOptionInput[];
  onChange?: (value: string | null) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  nothingFoundMessage?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  rightSection?: ReactNode;
  styles?: SelectStyles;
  required?: boolean;
  error?: ReactNode;
  "aria-label"?: string;
};

const SIZE_HEIGHT: Record<NonNullable<SelectProps["size"]>, number> = {
  xs: 34,
  sm: 38,
  md: 42,
  lg: 46,
};

function normalizeOptions(data: SelectOptionInput[]): SelectOption[] {
  const dedup = new Map<string, SelectOption>();
  for (const entry of data) {
    if (typeof entry === "string") {
      const value = entry.trim();
      if (!value || dedup.has(value)) continue;
      dedup.set(value, { value, label: value, disabled: false });
      continue;
    }
    const value = entry.value.trim();
    if (!value || dedup.has(value)) continue;
    dedup.set(value, {
      value,
      label: entry.label ?? value,
      disabled: Boolean(entry.disabled),
    });
  }
  return Array.from(dedup.values());
}

export function Select({
  value = null,
  data,
  onChange,
  placeholder = "Выбрать",
  searchable = false,
  clearable = false,
  disabled = false,
  className,
  size = "sm",
  nothingFoundMessage = "Ничего не найдено",
  searchValue,
  onSearchChange,
  rightSection,
  styles,
  required = false,
  error,
  "aria-label": ariaLabel,
}: SelectProps) {
  const options = useMemo(() => normalizeOptions(data), [data]);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const [localSearch, setLocalSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const controlHeight = SIZE_HEIGHT[size] ?? SIZE_HEIGHT.sm;
  const search = (searchValue ?? localSearch).trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!searchable || search.length === 0) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(search) ||
      option.value.toLowerCase().includes(search),
    );
  }, [options, searchable, search]);

  const inputValue = searchValue ?? localSearch;
  const displayValue = selectedOption?.value ?? "";

  const setSearch = (next: string) => {
    if (searchValue == null) {
      setLocalSearch(next);
    }
    onSearchChange?.(next);
  };

  const commitValue = (next: string | null) => {
    onChange?.(next);
    if (next == null) {
      setSearch("");
      return;
    }
    const match = options.find((option) => option.value === next);
    if (match) {
      setSearch(match.label);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setOpen(false);
    if (!searchable) return;
    const raw = (searchValue ?? localSearch).trim();
    if (!raw) {
      if (clearable) {
        commitValue(null);
      }
      return;
    }
    const match = options.find((option) => {
      const normalized = raw.toLowerCase();
      return option.value.toLowerCase() === normalized || option.label.toLowerCase() === normalized;
    });
    if (match && !match.disabled) {
      commitValue(match.value);
      return;
    }
    if (!selectedOption) {
      setSearch("");
      if (clearable) {
        commitValue(null);
      }
      return;
    }
    setSearch(selectedOption.label);
  };

  return (
    <div className={cn("relative", className)} onBlur={handleBlur}>
      {searchable ? (
        <div
          className={cn(
            "relative w-full rounded-md border border-border bg-surface text-sm text-text shadow-surface ui-interactive ui-focus-ring",
            disabled ? "opacity-50" : "",
            error ? "border-danger" : "",
          )}
          style={{ minHeight: controlHeight, ...styles?.input }}
        >
          <input
            value={inputValue}
            placeholder={placeholder}
            aria-label={ariaLabel}
            disabled={disabled}
            required={required}
            onFocus={() => {
              setOpen(true);
              setFocusedIndex(0);
            }}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setOpen(true);
              if (clearable && event.currentTarget.value.trim().length === 0) {
                commitValue(null);
              }
            }}
            onKeyDown={(event) => {
              if (!open) {
                if (event.key === "ArrowDown") {
                  setOpen(true);
                  event.preventDefault();
                }
                return;
              }
              if (event.key === "ArrowDown") {
                setFocusedIndex((prev) =>
                  Math.min(filteredOptions.length - 1, prev + 1),
                );
                event.preventDefault();
              } else if (event.key === "ArrowUp") {
                setFocusedIndex((prev) => Math.max(0, prev - 1));
                event.preventDefault();
              } else if (event.key === "Enter") {
                const selected = filteredOptions[focusedIndex];
                if (selected && !selected.disabled) {
                  commitValue(selected.value);
                  setOpen(false);
                  event.preventDefault();
                }
              } else if (event.key === "Escape") {
                setOpen(false);
                event.preventDefault();
              }
            }}
            className="h-full w-full bg-transparent px-3 pr-16 text-sm text-text placeholder:text-muted outline-none"
            style={{ height: controlHeight }}
          />
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-muted">
            {rightSection}
            {clearable && value ? (
              <button
                type="button"
                className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-full ui-focus-ring"
                onClick={() => {
                  commitValue(null);
                }}
                aria-label="Очистить"
              >
                <IconX size={14} />
              </button>
            ) : null}
            <IconChevronDown size={16} />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative w-full rounded-md border border-border bg-surface text-sm text-text shadow-surface ui-interactive ui-focus-ring",
            disabled ? "opacity-50" : "",
            error ? "border-danger" : "",
          )}
          style={{ minHeight: controlHeight, ...styles?.input }}
        >
          <select
            value={displayValue}
            aria-label={ariaLabel}
            required={required}
            disabled={disabled}
            onChange={(event) => {
              const nextValue = event.currentTarget.value.trim();
              commitValue(nextValue || null);
            }}
            className="h-full w-full appearance-none bg-transparent px-3 pr-10 text-sm text-text outline-none"
            style={{ height: controlHeight }}
          >
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted">
            {rightSection ?? <IconChevronDown size={16} />}
          </div>
        </div>
      )}

      {searchable && open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-[4300] mt-1 max-h-56 overflow-auto rounded-[14px] border border-glass-border bg-surface p-1 shadow-[0_12px_24px_var(--color-surface-overlay-soft)]"
          style={styles?.dropdown}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted">{nothingFoundMessage}</div>
          ) : (
            filteredOptions.map((option, index) => {
              const selected = option.value === value;
              const focused = index === focusedIndex;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  className={cn(
                    "flex w-full items-center rounded-[10px] px-2 py-1.5 text-left text-sm transition ui-focus-ring",
                    selected
                      ? "bg-[var(--color-brand-accent-soft)] text-text"
                      : focused
                        ? "bg-card text-text"
                        : "text-text",
                    option.disabled ? "opacity-50" : "",
                  )}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onClick={() => {
                    if (option.disabled) return;
                    commitValue(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              );
            })
          )}
        </div>
      )}

      {typeof error === "string" && error.length > 0 ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : null}
    </div>
  );
}
