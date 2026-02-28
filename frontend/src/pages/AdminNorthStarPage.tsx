import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  SegmentedControl,
  Select,
  Table,  
} from "../features/admin/ui";
import { notifications } from "../lib/notifications";
import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import {
  getAdminFunnel,
  getAdminNorthStar,
  searchAdminCafesByName,
  type AdminCafeSearchItem,
  type AdminFunnelReport,
  type AdminNorthStarReport,
} from "../api/adminMetrics";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";

type ScopeMode = "overall" | "cafe";

const RANGE_OPTIONS = [
  { value: "7", label: "7 дней" },
  { value: "14", label: "14 дней" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
];

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function buildCafeOptionLabel(item: AdminCafeSearchItem): string {
  const address = item.address?.trim();
  return address ? `${item.name} — ${address}` : item.name;
}

export default function AdminNorthStarPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status } = useAuth();

  const role = (user?.role ?? "").toLowerCase();
  const allowed = role === "admin" || role === "moderator";

  const [scope, setScope] = useState<ScopeMode>("overall");
  const [days, setDays] = useState<number>(14);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOptions, setSearchOptions] = useState<AdminCafeSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);

  const [report, setReport] = useState<AdminNorthStarReport | null>(null);
  const [funnelReport, setFunnelReport] = useState<AdminFunnelReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const selectedCafe = useMemo(
    () => searchOptions.find((item) => item.id === selectedCafeId) ?? null,
    [searchOptions, selectedCafeId],
  );

  useEffect(() => {
    if (!allowed || scope !== "cafe") return;

    const q = searchTerm.trim();
    if (q.length < 2) {
      setSearchOptions((prev) => (selectedCafe ? [selectedCafe] : prev.filter((item) => item.id === selectedCafeId)));
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void searchAdminCafesByName(q, 15)
        .then((items) => {
          if (cancelled) return;
          const next = [...items];
          if (selectedCafeId && !next.some((item) => item.id === selectedCafeId)) {
            const selected = selectedCafe;
            if (selected) {
              next.unshift(selected);
            }
          }
          setSearchOptions(next);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notifications.show({
            color: "red",
            title: "Ошибка поиска",
            message: extractApiErrorMessage(error, "Не удалось найти кофейни."),
          });
        })
        .finally(() => {
          if (!cancelled) {
            setSearchLoading(false);
          }
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allowed, scope, searchTerm, selectedCafeId, selectedCafe]);

  const loadReport = useCallback(async () => {
    if (!allowed) return;
    if (scope === "cafe" && !selectedCafeId) {
      setReport(null);
      setFunnelReport(null);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const params = {
        days,
        cafe_id: scope === "cafe" ? selectedCafeId ?? undefined : undefined,
      };
      const [nextReport, nextFunnelReport] = await Promise.all([
        getAdminNorthStar(params),
        getAdminFunnel(params),
      ]);
      setReport(nextReport);
      setFunnelReport(nextFunnelReport);
    } catch (error: unknown) {
      setLoadError(extractApiErrorMessage(error, "Не удалось загрузить метрики North Star."));
      setReport(null);
      setFunnelReport(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, days, scope, selectedCafeId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const scopeLabel =
    scope === "overall"
      ? "В целом по продукту"
      : selectedCafe
        ? `Кофейня: ${selectedCafe.name}`
        : "Кофейня не выбрана";

  const summaryCards = report?.summary
    ? [
        {
          key: "rate",
          label: "North Star rate",
          value: formatPercent(report.summary.rate),
        },
        {
          key: "north",
          label: "North Star journeys",
          value: String(report.summary.north_star_journeys),
        },
        {
          key: "intent",
          label: "Visit intent journeys",
          value: String(report.summary.visit_intent_journeys),
        },
      ]
    : [];

  if (status === "loading") {
    return (
      <div style={{ padding: 20 }}>
        <p className="m-0 text-sm text-text">Загрузка...</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div style={{ maxWidth: 640, marginInline: "auto", paddingTop: 24, paddingBottom: 24 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <h3 className="m-0 text-2xl font-bold text-text">Доступ ограничен</h3>
          <p style={{ margin: 0,  color: "var(--muted)" }}>
            Эта страница доступна модераторам и администраторам.
          </p>
          <Button onClick={() => void navigate("/settings")}>Назад</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ paddingBottom: 24 }}>
      <div style={{ maxWidth: 1080, marginInline: "auto", paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <ActionIcon
                size={42}
                className="glass-action glass-action--square"
                onClick={() => void navigate("/settings")}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <h3 className="m-0 text-2xl font-bold text-text">North Star метрика</h3>
            </div>
            <Button variant="secondary" onClick={() => void loadReport()} loading={loading}>
              Обновить
            </Button>
          </div>

          <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SegmentedControl
                    value={scope}
                    onChange={(value) => setScope(value as ScopeMode)}
                    data={[
                      { label: "В целом", value: "overall" },
                      { label: "По кофейне", value: "cafe" },
                    ]}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Select
                    label="Период"
                    data={RANGE_OPTIONS}
                    value={String(days)}
                    onChange={(value) => {
                      const parsed = Number(value ?? "14");
                      setDays(Number.isFinite(parsed) ? parsed : 14);
                    }}
                  />
                </div>
              </div>

              {scope === "cafe" && (
                <Select
                  label="Кофейня"
                  searchable
                  clearable
                  placeholder="Начните вводить название"
                  value={selectedCafeId}
                  searchValue={searchTerm}
                  onSearchChange={setSearchTerm}
                  onChange={(value) => {
                    setSelectedCafeId(value || null);
                  }}
                  nothingFoundMessage={searchTerm.trim().length < 2 ? "Введите минимум 2 символа" : "Ничего не найдено"}
                  data={searchOptions.map((item) => ({
                    value: item.id,
                    label: buildCafeOptionLabel(item),
                  }))}
                  rightSection={searchLoading ? <p style={{ margin: 0,  fontSize: 12 }}>...</p> : null}
                />
              )}

              <Alert icon={<IconInfoCircle size={16} />}>
                {scopeLabel}
              </Alert>
            </div>
          </div>

          {loadError && (
            <Alert color="red">
              {loadError}
            </Alert>
          )}

          {scope === "cafe" && !selectedCafeId ? (
            <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
              <p style={{ margin: 0,  color: "var(--muted)" }}>
                Выберите кофейню, чтобы посмотреть метрику по конкретному месту.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {summaryCards.map((card) => (
                  <div key={card.key} style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
                      <p style={{ margin: 0, 
                          fontSize: 12,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}
                      >
                        {card.label}
                      </p>
                      <p style={{ margin: 0,  fontSize: 28, fontWeight: 800, marginTop: 4 }}>
                        {card.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Дата</Table.Th>
                      <Table.Th>Intent journeys</Table.Th>
                      <Table.Th>North Star journeys</Table.Th>
                      <Table.Th>Rate</Table.Th>
                      <Table.Th>Тренд</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(report?.daily ?? []).map((point) => (
                      <Table.Tr key={point.date}>
                        <Table.Td>{formatDate(point.date)}</Table.Td>
                        <Table.Td>{point.visit_intent_journeys}</Table.Td>
                        <Table.Td>{point.north_star_journeys}</Table.Td>
                        <Table.Td>{formatPercent(point.rate)}</Table.Td>
                        <Table.Td>
                          <div
                            style={{
                              width: 120,
                              height: 8,
                              borderRadius: 999,
                              background: "color-mix(in srgb, var(--border) 80%, transparent)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(0, Math.min(100, point.rate * 100))}%`,
                                height: "100%",
                                borderRadius: 999,
                                background:
                                  "linear-gradient(90deg, var(--color-brand-accent), color-mix(in srgb, var(--color-brand-accent) 70%, var(--color-brand-accent-soft)))",
                              }}
                            />
                          </div>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {(report?.daily.length ?? 0) === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <p style={{ margin: 0,  color: "var(--muted)" }}>
                            За выбранный период данных пока нет.
                          </p>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </div>

              <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p style={{ margin: 0,  fontWeight: 700 }}>Воронка Journey</p>
                    <p style={{ margin: 0,  fontSize: 13, color: "var(--muted)" }}>
                      Карточка → отзыв → маршрут → check-in → отзыв
                    </p>
                  </div>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Этап</Table.Th>
                        <Table.Th>Journeys</Table.Th>
                        <Table.Th>CR от предыдущего</Table.Th>
                        <Table.Th>CR от старта</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(funnelReport?.stages ?? []).map((stage) => (
                        <Table.Tr key={stage.key}>
                          <Table.Td>{stage.label}</Table.Td>
                          <Table.Td>{stage.journeys}</Table.Td>
                          <Table.Td>{formatPercent(stage.conversion_from_prev)}</Table.Td>
                          <Table.Td>{formatPercent(stage.conversion_from_start)}</Table.Td>
                        </Table.Tr>
                      ))}
                      {(funnelReport?.stages.length ?? 0) === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <p style={{ margin: 0,  color: "var(--muted)" }}>
                              По воронке пока нет данных.
                            </p>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
