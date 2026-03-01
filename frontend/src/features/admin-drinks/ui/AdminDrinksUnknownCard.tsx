import { Badge, Button } from "../../admin/ui";
import { AppSelect } from "../../../ui/bridge";

import type { UnknownDrinkFormat } from "../../../api/adminDrinks";
import type { UnknownStatusOption } from "../model/types";

const UNKNOWN_STATUS_OPTIONS = [
  { value: "", label: "Все" },
  { value: "new", label: "new" },
  { value: "mapped", label: "mapped" },
  { value: "ignored", label: "ignored" },
];

type AdminDrinksUnknownCardProps = {
  status: UnknownStatusOption;
  unknown: UnknownDrinkFormat[];
  loading: boolean;
  drinkOptions: { value: string; label: string }[];
  unknownMapTarget: Record<number, string>;
  onStatusChange: (value: UnknownStatusOption) => void;
  onMapTargetChange: (id: number, drinkID: string) => void;
  onMapUnknown: (item: UnknownDrinkFormat) => void;
  onIgnoreUnknown: (item: UnknownDrinkFormat) => void;
};

export default function AdminDrinksUnknownCard({
  status,
  unknown,
  loading,
  drinkOptions,
  unknownMapTarget,
  onStatusChange,
  onMapTargetChange,
  onMapUnknown,
  onIgnoreUnknown,
}: AdminDrinksUnknownCardProps) {
  return (
    <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
          <h4 className="m-0 text-xl font-bold text-text">Неизвестные форматы</h4>
          <div style={{ width: 180 }}>
            <AppSelect
              implementation="radix"
              value={status}
              data={UNKNOWN_STATUS_OPTIONS}
              onChange={(value) => onStatusChange((value ?? "") as UnknownStatusOption)}
            />
          </div>
        </div>

        {loading && <p style={{ margin: 0,  color: "var(--muted)" }}>Загрузка форматов...</p>}
        {!loading && unknown.length === 0 && <p style={{ margin: 0,  color: "var(--muted)" }}>Список пуст.</p>}

        {unknown.map((item) => (
          <div key={item.id} style={{ border: "1px solid var(--border)",  borderRadius: 12, padding: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <p style={{ margin: 0,  fontWeight: 600 }}>{item.name}</p>
                  <Badge variant="secondary">mentions: {item.mentions_count}</Badge>
                  <Badge color={item.status === "new" ? "yellow" : "gray"}>{item.status}</Badge>
                </div>
                <p style={{ margin: 0,  fontSize: 12, color: "var(--muted)" }}>
                  last: {new Date(item.last_seen_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 12 }}>
                <label className="flex min-w-0 flex-col gap-1.5" style={{ width: 320 }}>
                  <span className="text-sm font-medium text-text">Привязать к напитку</span>
                  <AppSelect
                    implementation="radix"
                    searchable
                    placeholder="Выберите напиток"
                    data={drinkOptions}
                    value={unknownMapTarget[item.id] ?? item.mapped_drink_id ?? ""}
                    onChange={(value) => onMapTargetChange(item.id, value ?? "")}
                  />
                </label>
                <Button onClick={() => onMapUnknown(item)} disabled={item.status === "mapped"}>
                  Map + alias
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onIgnoreUnknown(item)}
                  disabled={item.status === "ignored"}
                >
                  Ignore
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
