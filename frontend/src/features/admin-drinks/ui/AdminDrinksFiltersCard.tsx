import { Input } from "../../../components/ui";

type AdminDrinksFiltersCardProps = {
  query: string;
  includeInactive: boolean;
  onQueryChange: (value: string) => void;
  onIncludeInactiveChange: (value: boolean) => void;
};

export default function AdminDrinksFiltersCard({
  query,
  includeInactive,
  onQueryChange,
  onIncludeInactiveChange,
}: AdminDrinksFiltersCardProps) {
  return (
    <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Поиск по справочнику</span>
          <Input
            placeholder="например, v60 или эспрессо"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-text">
          <button
            type="button"
            role="switch"
            aria-checked={includeInactive}
            onClick={() => onIncludeInactiveChange(!includeInactive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full border transition ui-focus-ring ${
              includeInactive
                ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]"
                : "border-border bg-surface"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                includeInactive ? "translate-x-[14px]" : "translate-x-[1px]"
              }`}
            />
          </button>
          <span>Показывать скрытые напитки</span>
        </label>
      </div>
    </div>
  );
}
