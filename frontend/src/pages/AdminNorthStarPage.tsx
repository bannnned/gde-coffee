import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notifications } from "../lib/notifications";
import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { Button, Select, Spinner, Table } from "../components/ui";

import {
  getAdminFunnel,
  getAdminMapPerf,
  getAdminNorthStar,
  getAdminTasteMap,
  setAdminMapPerfAlertState,
  searchAdminCafesByName,
  type AdminCafeSearchItem,
  type AdminFunnelReport,
  type AdminMapPerfDailyPoint,
  type AdminMapPerfNetworkPoint,
  type AdminMapPerfReport,
  type AdminMapPerfSummary,
  type AdminNorthStarReport,
  type AdminTasteMapReport,
} from "../api/adminMetrics";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";

type ScopeMode = "overall" | "cafe";
type PerfHealthLevel = "good" | "watch" | "risk";
type AlertFilter = "all" | "active" | "acked" | "snoozed";
type AlertDraft = { owner: string; comment: string };

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

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "n/a";
  return `${Math.round(value)} мс`;
}

function formatEffectiveType(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "unknown";
  return trimmed.toUpperCase();
}

function classifyLatency(valueMs: number, goodThreshold: number, watchThreshold: number): PerfHealthLevel {
  if (!Number.isFinite(valueMs) || valueMs <= 0) return "watch";
  if (valueMs <= goodThreshold) return "good";
  if (valueMs <= watchThreshold) return "watch";
  return "risk";
}

function classifyCoverage(value: number, goodThreshold: number, watchThreshold: number): PerfHealthLevel {
  if (!Number.isFinite(value) || value <= 0) return "risk";
  if (value >= goodThreshold) return "good";
  if (value >= watchThreshold) return "watch";
  return "risk";
}

function levelColor(level: PerfHealthLevel): string {
  if (level === "good") return "var(--color-success, #1f9d55)";
  if (level === "risk") return "var(--color-danger, #dc2626)";
  return "var(--color-warning, #d97706)";
}

function levelLabel(level: PerfHealthLevel): string {
  if (level === "good") return "Норма";
  if (level === "risk") return "Риск";
  return "Наблюдать";
}

function mapAlertStateLabel(state: "active" | "acked" | "snoozed", snoozedUntil?: string): string {
  if (state === "acked") return "В работе";
  if (state === "snoozed") {
    return snoozedUntil ? `Скрыт до ${formatDateTime(snoozedUntil)}` : "Скрыт";
  }
  return "Активен";
}

function mapAlertActionLabel(action: "ack" | "snooze" | "reset"): string {
  if (action === "ack") return "В работу";
  if (action === "snooze") return "Скрыть";
  return "Сброс";
}

type MapActionLoop = {
  overall: PerfHealthLevel;
  renderHealth: PerfHealthLevel;
  interactionHealth: PerfHealthLevel;
  coverageHealth: PerfHealthLevel;
  trendDeltaPct: number | null;
  slowNetwork: AdminMapPerfNetworkPoint | null;
  recommendations: string[];
};

function computeAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildActionLoop(
  summary: AdminMapPerfSummary | undefined,
  daily: AdminMapPerfDailyPoint[],
  network: AdminMapPerfNetworkPoint[],
): MapActionLoop {
  const renderHealth = classifyLatency(summary?.first_render_p95_ms ?? 0, 2200, 3200);
  const interactionHealth = classifyLatency(summary?.first_interaction_p95_ms ?? 0, 2800, 4200);
  const coverageHealth = classifyCoverage(summary?.interaction_coverage ?? 0, 0.55, 0.4);

  const withData = daily.filter((item) => item.first_render_events > 0 || item.first_interaction_events > 0);
  const recent = withData.slice(-3).map((item) => item.first_render_p95_ms).filter((value) => value > 0);
  const previous = withData
    .slice(Math.max(0, withData.length - 6), Math.max(0, withData.length - 3))
    .map((item) => item.first_render_p95_ms)
    .filter((value) => value > 0);
  const recentAvg = computeAverage(recent);
  const previousAvg = computeAverage(previous);
  const trendDeltaPct =
    previousAvg > 0 && recentAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : null;

  const slowNetwork = network
    .filter((item) => item.first_render_events >= 10)
    .sort((a, b) => b.first_render_p95_ms - a.first_render_p95_ms)[0] ?? null;

  const levelToWeight: Record<PerfHealthLevel, number> = { good: 1, watch: 2, risk: 3 };
  const all = [renderHealth, interactionHealth, coverageHealth];
  const overall = all.sort((a, b) => levelToWeight[b] - levelToWeight[a])[0];

  const recommendations: string[] = [];
  if (renderHealth === "risk") {
    recommendations.push("Проверить tile/style endpoint latency и CDN cache-hit для первых запросов карты.");
  } else if (renderHealth === "watch") {
    recommendations.push("Удерживать first render p95 ниже 3.2с: проверить размер style и warmup кэша.");
  }

  if (interactionHealth !== "good") {
    recommendations.push("Проверить события first interaction: map handlers и блокировки UI в первые секунды.");
  }

  if (coverageHealth !== "good") {
    recommendations.push("Довести interaction coverage: убедиться, что событие interaction отправляется стабильно.");
  }

  if (trendDeltaPct !== null && trendDeltaPct >= 15) {
    recommendations.push("Render p95 растет >15% к предыдущему окну: откатить последние изменения карты или стиля.");
  }

  if (slowNetwork && slowNetwork.first_render_p95_ms >= 4500) {
    recommendations.push(
      `Слабый сегмент сети (${formatEffectiveType(slowNetwork.effective_type)}): добавить degradations для 2g/3g и снизить вес карты.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Состояние стабильное: продолжаем мониторинг, без срочных action items.");
  }

  return {
    overall,
    renderHealth,
    interactionHealth,
    coverageHealth,
    trendDeltaPct,
    slowNetwork,
    recommendations,
  };
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
  const [mapPerfReport, setMapPerfReport] = useState<AdminMapPerfReport | null>(null);
  const [tasteMapReport, setTasteMapReport] = useState<AdminTasteMapReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alertActionKey, setAlertActionKey] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("active");
  const [alertDrafts, setAlertDrafts] = useState<Record<string, AlertDraft>>({});
  const lastAlertFingerprintRef = useRef<string>("");

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
      setMapPerfReport(null);
      setTasteMapReport(null);
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
      const [nextReport, nextFunnelReport, nextMapPerfReport, nextTasteMapReport] = await Promise.all([
        getAdminNorthStar(params),
        getAdminFunnel(params),
        getAdminMapPerf({ days }),
        getAdminTasteMap({ days }),
      ]);
      setReport(nextReport);
      setFunnelReport(nextFunnelReport);
      setMapPerfReport(nextMapPerfReport);
      setTasteMapReport(nextTasteMapReport);
    } catch (error: unknown) {
      setLoadError(extractApiErrorMessage(error, "Не удалось загрузить метрики North Star."));
      setReport(null);
      setFunnelReport(null);
      setMapPerfReport(null);
      setTasteMapReport(null);
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

  const mapPerfDaily = useMemo(() => mapPerfReport?.daily ?? [], [mapPerfReport?.daily]);
  const mapPerfNetwork = useMemo(() => mapPerfReport?.network ?? [], [mapPerfReport?.network]);
  const tasteDaily = useMemo(() => tasteMapReport?.daily ?? [], [tasteMapReport?.daily]);
  const tasteAlerts = useMemo(() => tasteMapReport?.alerts ?? [], [tasteMapReport?.alerts]);
  const maxDailyRenderP95 = useMemo(() => {
    return mapPerfDaily.reduce((max, point) => Math.max(max, point.first_render_p95_ms), 0);
  }, [mapPerfDaily]);
  const mapActionLoop = useMemo(
    () => buildActionLoop(mapPerfReport?.summary, mapPerfDaily, mapPerfNetwork),
    [mapPerfDaily, mapPerfNetwork, mapPerfReport?.summary],
  );
  const mapAlerts = useMemo(() => mapPerfReport?.alerts ?? [], [mapPerfReport?.alerts]);
  const mapAlertHistory = useMemo(() => mapPerfReport?.history ?? [], [mapPerfReport?.history]);
  const mapAlertActions = useMemo(() => mapPerfReport?.actions ?? [], [mapPerfReport?.actions]);
  const activeMapAlerts = useMemo(() => mapAlerts.filter((item) => item.state === "active"), [mapAlerts]);
  const filteredMapAlerts = useMemo(() => {
    if (alertFilter === "all") return mapAlerts;
    return mapAlerts.filter((item) => item.state === alertFilter);
  }, [alertFilter, mapAlerts]);

  useEffect(() => {
    setAlertDrafts((prev) => {
      const next = { ...prev };
      for (const alert of mapAlerts) {
        if (!next[alert.key]) {
          next[alert.key] = {
            owner: alert.owner ?? "",
            comment: alert.comment ?? "",
          };
        }
      }
      return next;
    });
  }, [mapAlerts]);

  useEffect(() => {
    const summary = mapPerfReport?.summary;
    if (!summary || summary.first_render_events <= 0 || activeMapAlerts.length === 0) {
      return;
    }
    const fingerprint = [summary.to, ...activeMapAlerts.map((item) => `${item.key}:${item.value}`)].join("|");

    if (lastAlertFingerprintRef.current === fingerprint) {
      return;
    }

    lastAlertFingerprintRef.current = fingerprint;

    const hasRisk = activeMapAlerts.some((item) => item.severity === "risk");
    notifications.show({
      color: hasRisk ? "red" : "yellow",
      title: "Map performance alert",
      message: `Найдено алертов: ${activeMapAlerts.length}. Render p95 ${formatMs(summary.first_render_p95_ms)}, coverage ${formatPercent(summary.interaction_coverage)}.`,
    });
  }, [activeMapAlerts, mapPerfReport?.summary]);

  const handleAlertAction = useCallback(
    async (alertKey: string, action: "ack" | "snooze" | "reset") => {
      const draft = alertDrafts[alertKey] ?? { owner: "", comment: "" };
      if (action === "ack" && !draft.owner.trim()) {
        notifications.show({
          color: "yellow",
          title: "Нужен owner",
          message: "Для действия 'В работу' укажите owner.",
        });
        return;
      }
      setAlertActionKey(`${alertKey}:${action}`);
      try {
        await setAdminMapPerfAlertState(alertKey, {
          action,
          snooze_hours: action === "snooze" ? 24 : undefined,
          owner: draft.owner.trim() || undefined,
          comment: draft.comment.trim() || undefined,
        });
        await loadReport();
      } catch (error: unknown) {
        notifications.show({
          color: "red",
          title: "Не удалось обновить alert",
          message: extractApiErrorMessage(error, "Попробуйте еще раз."),
        });
      } finally {
        setAlertActionKey(null);
      }
    },
    [alertDrafts, loadReport],
  );

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
              <Button
                variant="ghost"
                size="icon"
                className="glass-action glass-action--square"
                style={{ width: 42, height: 42 }}
                onClick={() => void navigate("/settings")}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </Button>
              <h3 className="m-0 text-2xl font-bold text-text">North Star метрика</h3>
            </div>
            <Button variant="secondary" onClick={() => void loadReport()} disabled={loading}>
              {loading ? <Spinner size={14} /> : null}
              Обновить
            </Button>
          </div>

          <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      padding: 4,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    {[
                      { label: "В целом", value: "overall" },
                      { label: "По кофейне", value: "cafe" },
                    ].map((item) => {
                      const active = item.value === scope;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          className="ui-focus-ring"
                          onClick={() => setScope(item.value as ScopeMode)}
                          style={{
                            flex: 1,
                            border: "none",
                            background: active
                              ? "var(--color-brand-accent)"
                              : "transparent",
                            color: active ? "var(--color-on-accent)" : "var(--text)",
                            fontWeight: 600,
                            borderRadius: 10,
                            padding: "8px 10px",
                            cursor: "pointer",
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-sm font-medium text-text">Период</span>
                    <Select
                      data={RANGE_OPTIONS}
                      value={String(days)}
                      onChange={(value) => {
                        const parsed = Number(value ?? "14");
                        setDays(Number.isFinite(parsed) ? parsed : 14);
                      }}
                    />
                  </label>
                </div>
              </div>

              {scope === "cafe" && (
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-sm font-medium text-text">Кофейня</span>
                  <Select
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
                </label>
              )}

              <div
                className="rounded-[14px] border px-3 py-2"
                style={{
                  borderColor: "var(--color-status-info)",
                  background: "color-mix(in srgb, var(--surface) 82%, transparent)",
                  color: "var(--text)",
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">
                    <IconInfoCircle size={16} />
                  </span>
                  <div className="min-w-0 text-sm">{scopeLabel}</div>
                </div>
              </div>
            </div>
          </div>

          {loadError && (
            <div
              className="rounded-[14px] border px-3 py-2 text-sm"
              style={{
                borderColor: "var(--color-status-error)",
                background: "color-mix(in srgb, var(--surface) 82%, transparent)",
                color: "var(--text)",
              }}
            >
              {loadError}
            </div>
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

              <div style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Map performance</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      first render / first interaction
                    </p>
                  </div>

                  {scope === "cafe" && (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      Эта метрика считается глобально по приложению (не по конкретной кофейне).
                    </p>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {[
                      {
                        key: "render_p50",
                        label: "Render p50",
                        value: formatMs(mapPerfReport?.summary.first_render_p50_ms ?? 0),
                      },
                      {
                        key: "render_p95",
                        label: "Render p95",
                        value: formatMs(mapPerfReport?.summary.first_render_p95_ms ?? 0),
                      },
                      {
                        key: "interaction_p50",
                        label: "Interaction p50",
                        value: formatMs(mapPerfReport?.summary.first_interaction_p50_ms ?? 0),
                      },
                      {
                        key: "interaction_p95",
                        label: "Interaction p95",
                        value: formatMs(mapPerfReport?.summary.first_interaction_p95_ms ?? 0),
                      },
                      {
                        key: "coverage",
                        label: "Interaction coverage",
                        value: formatPercent(mapPerfReport?.summary.interaction_coverage ?? 0),
                      },
                    ].map((item) => (
                      <div key={item.key} style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              color: "var(--muted)",
                              textTransform: "uppercase",
                              fontWeight: 700,
                            }}
                          >
                            {item.label}
                          </p>
                          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, marginTop: 3 }}>
                            {item.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                    События: render {mapPerfReport?.summary.first_render_events ?? 0} · interaction{" "}
                    {mapPerfReport?.summary.first_interaction_events ?? 0}
                  </p>

                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Active alerts</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[
                        { key: "active", label: "Активные" },
                        { key: "acked", label: "В работе" },
                        { key: "snoozed", label: "Скрытые" },
                        { key: "all", label: "Все" },
                      ].map((option) => {
                        const active = alertFilter === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            className="ui-focus-ring"
                            onClick={() => setAlertFilter(option.key as AlertFilter)}
                            style={{
                              borderRadius: 999,
                              padding: "4px 10px",
                              border: "1px solid var(--border)",
                              background: active ? "var(--color-brand-accent)" : "transparent",
                              color: active ? "var(--color-on-accent)" : "var(--text)",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {filteredMapAlerts.length > 0 ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {filteredMapAlerts.map((item) => {
                          const color = item.severity === "risk" ? "var(--color-danger, #dc2626)" : "var(--color-warning, #d97706)";
                          const draft = alertDrafts[item.key] ?? { owner: item.owner ?? "", comment: item.comment ?? "" };
                          return (
                            <div
                              key={item.key}
                              style={{
                                border: `1px solid color-mix(in srgb, ${color} 35%, var(--border))`,
                                borderRadius: 12,
                                padding: "8px 10px",
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                                {item.label}: {item.value}
                              </p>
                              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                                {item.target} · {mapAlertStateLabel(item.state, item.snoozed_until)}
                              </p>
                              <div style={{ display: "grid", gap: 6, width: "100%" }}>
                                <input
                                  className="ui-focus-ring"
                                  value={draft.owner}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value;
                                    setAlertDrafts((prev) => ({
                                      ...prev,
                                      [item.key]: {
                                        owner: value,
                                        comment: prev[item.key]?.comment ?? item.comment ?? "",
                                      },
                                    }));
                                  }}
                                  placeholder="Owner (кто ведет)"
                                  style={{
                                    width: "100%",
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    padding: "6px 8px",
                                    background: "var(--surface)",
                                    color: "var(--text)",
                                  }}
                                />
                                <input
                                  className="ui-focus-ring"
                                  value={draft.comment}
                                  onChange={(event) => {
                                    const value = event.currentTarget.value;
                                    setAlertDrafts((prev) => ({
                                      ...prev,
                                      [item.key]: {
                                        owner: prev[item.key]?.owner ?? item.owner ?? "",
                                        comment: value,
                                      },
                                    }));
                                  }}
                                  placeholder="Комментарий (что делаем)"
                                  style={{
                                    width: "100%",
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    padding: "6px 8px",
                                    background: "var(--surface)",
                                    color: "var(--text)",
                                  }}
                                />
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {item.state !== "acked" && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void handleAlertAction(item.key, "ack")}
                                    disabled={Boolean(alertActionKey)}
                                  >
                                    {alertActionKey === `${item.key}:ack` ? <Spinner size={12} /> : null}
                                    В работу
                                  </Button>
                                )}
                                {item.state !== "snoozed" && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void handleAlertAction(item.key, "snooze")}
                                    disabled={Boolean(alertActionKey)}
                                  >
                                    {alertActionKey === `${item.key}:snooze` ? <Spinner size={12} /> : null}
                                    Скрыть 24ч
                                  </Button>
                                )}
                                {item.state !== "active" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleAlertAction(item.key, "reset")}
                                    disabled={Boolean(alertActionKey)}
                                  >
                                    {alertActionKey === `${item.key}:reset` ? <Spinner size={12} /> : null}
                                    Сбросить
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                        По выбранному фильтру алертов нет.
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>Action loop</p>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          color: levelColor(mapActionLoop.overall),
                          background: "color-mix(in srgb, var(--surface) 75%, var(--border))",
                          border: `1px solid color-mix(in srgb, ${levelColor(mapActionLoop.overall)} 28%, var(--border))`,
                        }}
                      >
                        Статус: {levelLabel(mapActionLoop.overall)}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {[
                        { key: "render", label: "Render p95", level: mapActionLoop.renderHealth },
                        { key: "interaction", label: "Interaction p95", level: mapActionLoop.interactionHealth },
                        { key: "coverage", label: "Coverage", level: mapActionLoop.coverageHealth },
                      ].map((item) => (
                        <span
                          key={item.key}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 999,
                            padding: "4px 10px",
                            border: `1px solid color-mix(in srgb, ${levelColor(item.level)} 30%, var(--border))`,
                            color: "var(--text)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: levelColor(item.level),
                            }}
                          />
                          {item.label}: {levelLabel(item.level)}
                        </span>
                      ))}
                    </div>

                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      Тренд render p95 (последние 3 дня к предыдущим 3):{" "}
                      {mapActionLoop.trendDeltaPct === null
                        ? "недостаточно данных"
                        : `${mapActionLoop.trendDeltaPct > 0 ? "+" : ""}${mapActionLoop.trendDeltaPct.toFixed(1)}%`}
                    </p>

                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      Самый медленный сетевой сегмент:{" "}
                      {mapActionLoop.slowNetwork
                        ? `${formatEffectiveType(mapActionLoop.slowNetwork.effective_type)} (${formatMs(mapActionLoop.slowNetwork.first_render_p95_ms)})`
                        : "недостаточно данных"}
                    </p>

                    <div style={{ display: "grid", gap: 6 }}>
                      {mapActionLoop.recommendations.map((item) => (
                        <p key={item} style={{ margin: 0, fontSize: 13 }}>
                          • {item}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Alert history</p>
                    <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                          <Table.Th>Дата</Table.Th>
                          <Table.Th>Статус</Table.Th>
                          <Table.Th>Render p95</Table.Th>
                          <Table.Th>Interaction p95</Table.Th>
                          <Table.Th>Coverage</Table.Th>
                          <Table.Th>Тренд</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {mapAlertHistory.map((entry) => (
                          <Table.Tr key={entry.date}>
                            <Table.Td>{formatDate(entry.date)}</Table.Td>
                            <Table.Td>
                              <span style={{ color: levelColor(entry.status), fontWeight: 700 }}>{levelLabel(entry.status)}</span>
                            </Table.Td>
                            <Table.Td>{formatMs(entry.first_render_p95_ms)}</Table.Td>
                            <Table.Td>{formatMs(entry.first_interaction_p95_ms)}</Table.Td>
                            <Table.Td>{formatPercent(entry.interaction_coverage)}</Table.Td>
                            <Table.Td>
                              {`${entry.trend_delta_pct > 0 ? "+" : ""}${entry.trend_delta_pct.toFixed(1)}%`}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        {mapAlertHistory.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <p style={{ margin: 0, color: "var(--muted)" }}>
                                История алертов пока пуста.
                              </p>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Action history</p>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Время</Table.Th>
                          <Table.Th>Alert</Table.Th>
                          <Table.Th>Действие</Table.Th>
                          <Table.Th>Owner</Table.Th>
                          <Table.Th>Комментарий</Table.Th>
                          <Table.Th>Кто</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {mapAlertActions.map((action) => (
                          <Table.Tr key={`${action.created_at}-${action.alert_key}-${action.action}`}>
                            <Table.Td>{formatDateTime(action.created_at)}</Table.Td>
                            <Table.Td>{action.alert_key}</Table.Td>
                            <Table.Td>
                              {mapAlertActionLabel(action.action)}
                              {action.action === "snooze" && action.snooze_hours ? ` (${action.snooze_hours}ч)` : ""}
                            </Table.Td>
                            <Table.Td>{action.owner || "—"}</Table.Td>
                            <Table.Td>{action.comment || "—"}</Table.Td>
                            <Table.Td>{action.actor_user_id || "system"}</Table.Td>
                          </Table.Tr>
                        ))}
                        {mapAlertActions.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <p style={{ margin: 0, color: "var(--muted)" }}>
                                История действий пока пуста.
                              </p>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Daily trend</p>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Дата</Table.Th>
                          <Table.Th>Render p95</Table.Th>
                          <Table.Th>Interaction p95</Table.Th>
                          <Table.Th>Coverage</Table.Th>
                          <Table.Th>Тренд</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {mapPerfDaily.map((point) => {
                          const trendWidth =
                            maxDailyRenderP95 > 0
                              ? Math.max(0, Math.min(100, (point.first_render_p95_ms / maxDailyRenderP95) * 100))
                              : 0;
                          return (
                            <Table.Tr key={point.date}>
                              <Table.Td>{formatDate(point.date)}</Table.Td>
                              <Table.Td>{formatMs(point.first_render_p95_ms)}</Table.Td>
                              <Table.Td>{formatMs(point.first_interaction_p95_ms)}</Table.Td>
                              <Table.Td>{formatPercent(point.interaction_coverage)}</Table.Td>
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
                                      width: `${trendWidth}%`,
                                      height: "100%",
                                      borderRadius: 999,
                                      background:
                                        "linear-gradient(90deg, var(--color-brand-accent), color-mix(in srgb, var(--color-brand-accent) 70%, var(--color-brand-accent-soft)))",
                                    }}
                                  />
                                </div>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                        {mapPerfDaily.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={5}>
                              <p style={{ margin: 0, color: "var(--muted)" }}>
                                По daily trend пока нет данных.
                              </p>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Network breakdown</p>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Сеть</Table.Th>
                          <Table.Th>Render p95</Table.Th>
                          <Table.Th>Interaction p95</Table.Th>
                          <Table.Th>Render events</Table.Th>
                          <Table.Th>Interaction events</Table.Th>
                          <Table.Th>Coverage</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {mapPerfNetwork.map((row) => (
                          <Table.Tr key={row.effective_type || "unknown"}>
                            <Table.Td>{formatEffectiveType(row.effective_type)}</Table.Td>
                            <Table.Td>{formatMs(row.first_render_p95_ms)}</Table.Td>
                            <Table.Td>{formatMs(row.first_interaction_p95_ms)}</Table.Td>
                            <Table.Td>{row.first_render_events}</Table.Td>
                            <Table.Td>{row.first_interaction_events}</Table.Td>
                            <Table.Td>{formatPercent(row.interaction_coverage)}</Table.Td>
                          </Table.Tr>
                        ))}
                        {mapPerfNetwork.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <p style={{ margin: 0, color: "var(--muted)" }}>
                                По network breakdown пока нет данных.
                              </p>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Taste Map health</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      onboarding / hypotheses / inference
                    </p>
                  </div>

                  {scope === "cafe" && (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                      Метрика считается на уровне продукта и не фильтруется по отдельной кофейне.
                    </p>
                  )}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {[
                      {
                        key: "completion",
                        label: "Onboarding completion",
                        value: formatPercent(tasteMapReport?.summary.onboarding_completion_rate ?? 0),
                      },
                      {
                        key: "confirm_rate",
                        label: "Feedback confirm rate",
                        value: formatPercent(tasteMapReport?.summary.feedback_confirm_rate ?? 0),
                      },
                      {
                        key: "api_errors",
                        label: "Taste API errors",
                        value: String(tasteMapReport?.summary.api_errors ?? 0),
                      },
                      {
                        key: "inference_failures",
                        label: "Inference failure rate",
                        value: formatPercent(tasteMapReport?.summary.inference_failure_rate ?? 0),
                      },
                      {
                        key: "inference_p95",
                        label: "Inference latency p95",
                        value: formatMs(tasteMapReport?.summary.inference_latency_p95_ms ?? 0),
                      },
                    ].map((item) => (
                      <div key={item.key} style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              color: "var(--muted)",
                              textTransform: "uppercase",
                              fontWeight: 700,
                            }}
                          >
                            {item.label}
                          </p>
                          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, marginTop: 3 }}>
                            {item.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                    Events: onboarding start {tasteMapReport?.summary.onboarding_started ?? 0} · completed{" "}
                    {tasteMapReport?.summary.onboarding_completed ?? 0} · shown {tasteMapReport?.summary.hypothesis_shown ?? 0} ·
                    dismissed {tasteMapReport?.summary.hypothesis_dismissed ?? 0} · confirmed {tasteMapReport?.summary.hypothesis_confirmed ?? 0}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                    Recompute: events {tasteMapReport?.summary.recompute_events ?? 0} · runs {tasteMapReport?.summary.inference_runs ?? 0} · failed{" "}
                    {tasteMapReport?.summary.inference_failed_runs ?? 0}
                  </p>

                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Taste alerts</p>
                    {tasteAlerts.length > 0 ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {tasteAlerts.map((item) => {
                          const color = item.severity === "risk" ? "var(--color-danger, #dc2626)" : "var(--color-warning, #d97706)";
                          return (
                            <div
                              key={item.key}
                              style={{
                                border: `1px solid color-mix(in srgb, ${color} 35%, var(--border))`,
                                borderRadius: 12,
                                padding: "8px 10px",
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                                {item.label}: {item.value}
                              </p>
                              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                                target {item.target}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                        Активных алертов Taste Map нет.
                      </p>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>Taste daily trend</p>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Дата</Table.Th>
                          <Table.Th>Started</Table.Th>
                          <Table.Th>Completed</Table.Th>
                          <Table.Th>Shown</Table.Th>
                          <Table.Th>Dismissed</Table.Th>
                          <Table.Th>Confirmed</Table.Th>
                          <Table.Th>API errors</Table.Th>
                          <Table.Th>Inference failed/runs</Table.Th>
                          <Table.Th>Inference p95</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {tasteDaily.map((point) => (
                          <Table.Tr key={point.date}>
                            <Table.Td>{formatDate(point.date)}</Table.Td>
                            <Table.Td>{point.onboarding_started}</Table.Td>
                            <Table.Td>{point.onboarding_completed}</Table.Td>
                            <Table.Td>{point.hypothesis_shown}</Table.Td>
                            <Table.Td>{point.hypothesis_dismissed}</Table.Td>
                            <Table.Td>{point.hypothesis_confirmed}</Table.Td>
                            <Table.Td>{point.api_errors}</Table.Td>
                            <Table.Td>
                              {point.inference_failed_runs}/{point.inference_runs} ({formatPercent(point.inference_failure_rate)})
                            </Table.Td>
                            <Table.Td>{formatMs(point.inference_p95_ms)}</Table.Td>
                          </Table.Tr>
                        ))}
                        {tasteDaily.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={9}>
                              <p style={{ margin: 0, color: "var(--muted)" }}>
                                По Taste Map trend пока нет данных.
                              </p>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
