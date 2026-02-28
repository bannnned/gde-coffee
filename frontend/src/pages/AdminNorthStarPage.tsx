import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "../ui/compat/core";
import { notifications } from "@mantine/notifications";
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
      <Box p="lg">
        <Text>Загрузка...</Text>
      </Box>
    );
  }

  if (!allowed) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Title order={3}>Доступ ограничен</Title>
          <Text c="dimmed">Эта страница доступна модераторам и администраторам.</Text>
          <Button onClick={() => void navigate("/settings")}>Назад</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Box className="page-shell" pb="xl">
      <Container size="lg" py="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Group>
              <ActionIcon
                size={42}
                variant="transparent"
                className="glass-action glass-action--square"
                onClick={() => void navigate("/settings")}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Title order={3}>North Star метрика</Title>
            </Group>
            <Button variant="light" onClick={() => void loadReport()} loading={loading}>
              Обновить
            </Button>
          </Group>

          <Paper withBorder radius="lg" p="md">
            <Stack gap="sm">
              <Group grow align="flex-end">
                <SegmentedControl
                  value={scope}
                  onChange={(value) => setScope(value as ScopeMode)}
                  data={[
                    { label: "В целом", value: "overall" },
                    { label: "По кофейне", value: "cafe" },
                  ]}
                />
                <Select
                  label="Период"
                  data={RANGE_OPTIONS}
                  value={String(days)}
                  onChange={(value) => {
                    const parsed = Number(value ?? "14");
                    setDays(Number.isFinite(parsed) ? parsed : 14);
                  }}
                />
              </Group>

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
                  rightSection={searchLoading ? <Text size="xs">...</Text> : null}
                />
              )}

              <Alert variant="light" icon={<IconInfoCircle size={16} />}>
                {scopeLabel}
              </Alert>
            </Stack>
          </Paper>

          {loadError && (
            <Alert color="red" variant="light">
              {loadError}
            </Alert>
          )}

          {scope === "cafe" && !selectedCafeId ? (
            <Paper withBorder radius="lg" p="md">
              <Text c="dimmed">Выберите кофейню, чтобы посмотреть метрику по конкретному месту.</Text>
            </Paper>
          ) : (
            <>
              <Group grow>
                {summaryCards.map((card) => (
                  <Paper key={card.key} withBorder radius="lg" p="md">
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {card.label}
                    </Text>
                    <Text size="xl" fw={800} mt={4}>
                      {card.value}
                    </Text>
                  </Paper>
                ))}
              </Group>

              <Paper withBorder radius="lg" p="md">
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
                          <Box
                            style={{
                              width: 120,
                              height: 8,
                              borderRadius: 999,
                              background: "color-mix(in srgb, var(--border) 80%, transparent)",
                              overflow: "hidden",
                            }}
                          >
                            <Box
                              style={{
                                width: `${Math.max(0, Math.min(100, point.rate * 100))}%`,
                                height: "100%",
                                borderRadius: 999,
                                background:
                                  "linear-gradient(90deg, var(--color-brand-accent), color-mix(in srgb, var(--color-brand-accent) 70%, var(--color-brand-accent-soft)))",
                              }}
                            />
                          </Box>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {(report?.daily.length ?? 0) === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed">За выбранный период данных пока нет.</Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Paper>

              <Paper withBorder radius="lg" p="md">
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={700}>Воронка Journey</Text>
                    <Text size="sm" c="dimmed">
                      Карточка → отзыв → маршрут → check-in → отзыв
                    </Text>
                  </Group>
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
                            <Text c="dimmed">По воронке пока нет данных.</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Paper>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
