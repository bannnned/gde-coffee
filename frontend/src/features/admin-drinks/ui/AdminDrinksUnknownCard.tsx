import { Badge, Button, Paper, Select } from "../../admin/ui";

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
    <Paper style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
          <h4 className="m-0 text-xl font-bold text-text">Неизвестные форматы</h4>
          <Select
            value={status}
            data={UNKNOWN_STATUS_OPTIONS}
            style={{ width: 180 }}
            onChange={(value) => onStatusChange((value ?? "") as UnknownStatusOption)}
          />
        </div>

        {loading && <p style={{ margin: 0,  color: "var(--muted)" }}>Загрузка форматов...</p>}
        {!loading && unknown.length === 0 && <p style={{ margin: 0,  color: "var(--muted)" }}>Список пуст.</p>}

        {unknown.map((item) => (
          <Paper key={item.id} style={{ border: "1px solid var(--border)",  borderRadius: 12, padding: 12 }}>
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
                <Select
                  searchable
                  style={{ width: 320 }}
                  label="Привязать к напитку"
                  placeholder="Выберите напиток"
                  data={drinkOptions}
                  value={unknownMapTarget[item.id] ?? item.mapped_drink_id ?? ""}
                  onChange={(value) => onMapTargetChange(item.id, value ?? "")}
                />
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
          </Paper>
        ))}
      </div>
    </Paper>
  );
}
