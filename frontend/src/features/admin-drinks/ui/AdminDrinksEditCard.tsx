import { Button } from "../../admin/ui";
import { Input } from "../../../components/ui";

import type { DrinkEditorState } from "../model/types";

type AdminDrinksEditCardProps = {
  drinkID: string;
  state: DrinkEditorState | null;
  loading: boolean;
  onChange: (patch: Partial<DrinkEditorState>) => void;
  onSave: () => void;
};

export default function AdminDrinksEditCard({
  drinkID,
  state,
  loading,
  onChange,
  onSave,
}: AdminDrinksEditCardProps) {
  if (!state) return null;

  return (
    <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <h4 className="m-0 text-xl font-bold text-text">Редактирование: {drinkID}</h4>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Название</span>
          <Input value={state.name} onChange={(event) => onChange({ name: event.currentTarget.value })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Алиасы</span>
          <span className="text-xs text-muted">Через запятую</span>
          <Input value={state.aliases} onChange={(event) => onChange({ aliases: event.currentTarget.value })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Категория</span>
          <Input value={state.category} onChange={(event) => onChange({ category: event.currentTarget.value })} />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Популярность</span>
          <Input
            value={state.popularityRank}
            onChange={(event) => onChange({ popularityRank: event.currentTarget.value })}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Короткое описание</span>
          <textarea
            rows={2}
            className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted shadow-surface ui-focus-ring"
            value={state.description}
            onChange={(event) => onChange({ description: event.currentTarget.value })}
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-text">
          <button
            type="button"
            role="switch"
            aria-checked={state.isActive}
            onClick={() => onChange({ isActive: !state.isActive })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full border transition ui-focus-ring ${
              state.isActive
                ? "border-[var(--color-brand-accent)] bg-[var(--color-brand-accent)]"
                : "border-border bg-surface"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                state.isActive ? "translate-x-[14px]" : "translate-x-[1px]"
              }`}
            />
          </button>
          <span>Активный</span>
        </label>
        <Button loading={loading} onClick={onSave}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}
