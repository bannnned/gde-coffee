import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Container,
  Group,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  Title,
} from "../features/admin/ui";
import { notifications } from "../lib/notifications";
import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { importAdminCafesJSON, type AdminCafeImportItem, type AdminCafeImportResponse } from "../api/adminCafes";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";

const maxPreviewRows = 20;

const sampleJSON = `[
  {
    "name": "Surf Coffee",
    "address": "Nevsky 42",
    "latitude": 59.9343,
    "longitude": 30.3351,
    "description": "Specialty coffee and cozy interior.",
    "amenities": ["wifi", "power", "toilet"]
  }
]`;

type PreviewIssue = {
  index: number;
  field?: string;
  message: string;
};

type PreviewRow = {
  index: number;
  status: "ok" | "invalid";
  name: string;
  address: string;
  message: string;
};

type PreviewState = {
  fatalError: string | null;
  rawTotal: number;
  validItems: AdminCafeImportItem[];
  rows: PreviewRow[];
  issues: PreviewIssue[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function extractCafeItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object" && "cafes" in payload) {
    const record = payload as { cafes?: unknown };
    if (Array.isArray(record.cafes)) {
      return record.cafes;
    }
  }
  throw new Error("Ожидается JSON-массив кофеен или объект формата { cafes: [...] }.");
}

function toCSVCell(value: string): string {
  return `"${value.replaceAll(`"`, `""`)}"`;
}

function issuesToCSV(issues: PreviewIssue[]): string {
  const header = "index,field,message";
  const rows = issues.map((issue) =>
    [String(issue.index), issue.field ?? "", issue.message]
      .map((cell) => toCSVCell(cell))
      .join(","),
  );
  return [header, ...rows].join("\n");
}

function downloadTextFile(filename: string, contentType: string, content: string) {
  const blob = new Blob([content], { type: contentType });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function normalizePreviewItem(
  raw: unknown,
  index: number,
): { item: AdminCafeImportItem | null; row: PreviewRow; issues: PreviewIssue[] } {
  const rowIndex = index + 1;
  if (!isRecord(raw)) {
    const issue = { index: rowIndex, message: "Элемент должен быть JSON-объектом." };
    return {
      item: null,
      row: {
        index: rowIndex,
        status: "invalid",
        name: "",
        address: "",
        message: issue.message,
      },
      issues: [issue],
    };
  }

  const issues: PreviewIssue[] = [];
  const rawName = raw.name;
  const rawAddress = raw.address;
  const rawLatitude = raw.latitude;
  const rawLongitude = raw.longitude;

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const address = typeof rawAddress === "string" ? rawAddress.trim() : "";

  if (!name) {
    issues.push({ index: rowIndex, field: "name", message: "Название обязательно." });
  }
  if (!address) {
    issues.push({ index: rowIndex, field: "address", message: "Адрес обязателен." });
  }

  if (typeof rawLatitude !== "number" || !Number.isFinite(rawLatitude)) {
    issues.push({
      index: rowIndex,
      field: "latitude",
      message: "latitude должен быть числом.",
    });
  } else if (rawLatitude < -90 || rawLatitude > 90) {
    issues.push({
      index: rowIndex,
      field: "latitude",
      message: "latitude должен быть в диапазоне от -90 до 90.",
    });
  }

  if (typeof rawLongitude !== "number" || !Number.isFinite(rawLongitude)) {
    issues.push({
      index: rowIndex,
      field: "longitude",
      message: "longitude должен быть числом.",
    });
  } else if (rawLongitude < -180 || rawLongitude > 180) {
    issues.push({
      index: rowIndex,
      field: "longitude",
      message: "longitude должен быть в диапазоне от -180 до 180.",
    });
  }

  const hasDescription = hasOwn(raw, "description");
  let description = "";
  if (hasDescription) {
    if (typeof raw.description !== "string") {
      issues.push({
        index: rowIndex,
        field: "description",
        message: "description должен быть строкой.",
      });
    } else {
      description = raw.description.trim();
      if (description.length > 2000) {
        issues.push({
          index: rowIndex,
          field: "description",
          message: "Описание слишком длинное (максимум 2000 символов).",
        });
      }
    }
  }

  const hasAmenities = hasOwn(raw, "amenities");
  let amenities: string[] = [];
  if (hasAmenities) {
    if (!Array.isArray(raw.amenities)) {
      issues.push({
        index: rowIndex,
        field: "amenities",
        message: "amenities должен быть массивом строк.",
      });
    } else {
      const normalizedAmenities: string[] = [];
      const seen = new Set<string>();
      for (const value of raw.amenities) {
        if (typeof value !== "string") {
          issues.push({
            index: rowIndex,
            field: "amenities",
            message: "Каждая amenity должна быть строкой.",
          });
          continue;
        }
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
          continue;
        }
        if (normalized.length > 50) {
          issues.push({
            index: rowIndex,
            field: "amenities",
            message: "Каждая amenity должна быть не длиннее 50 символов.",
          });
          continue;
        }
        if (seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        normalizedAmenities.push(normalized);
      }
      amenities = normalizedAmenities;
    }
  }

  if (issues.length > 0) {
    return {
      item: null,
      row: {
        index: rowIndex,
        status: "invalid",
        name,
        address,
        message: issues[0].message,
      },
      issues,
    };
  }

  const item: AdminCafeImportItem = {
    name,
    address,
    latitude: rawLatitude as number,
    longitude: rawLongitude as number,
  };
  if (hasDescription) {
    item.description = description;
  }
  if (hasAmenities) {
    item.amenities = amenities;
  }

  return {
    item,
    row: {
      index: rowIndex,
      status: "ok",
      name,
      address,
      message: "OK",
    },
    issues: [],
  };
}

function buildPreview(jsonText: string): PreviewState {
  let payload: unknown;
  try {
    payload = JSON.parse(jsonText) as unknown;
  } catch {
    return {
      fatalError: "JSON не распарсен. Исправьте синтаксис.",
      rawTotal: 0,
      validItems: [],
      rows: [],
      issues: [],
    };
  }

  let rawItems: unknown[];
  try {
    rawItems = extractCafeItems(payload);
  } catch (error: unknown) {
    return {
      fatalError:
        error instanceof Error ? error.message : "Ожидается JSON-массив кофеен или объект с полем cafes.",
      rawTotal: 0,
      validItems: [],
      rows: [],
      issues: [],
    };
  }

  const validItems: AdminCafeImportItem[] = [];
  const rows: PreviewRow[] = [];
  const issues: PreviewIssue[] = [];

  rawItems.forEach((rawItem, index) => {
    const normalized = normalizePreviewItem(rawItem, index);
    rows.push(normalized.row);
    issues.push(...normalized.issues);
    if (normalized.item) {
      validItems.push(normalized.item);
    }
  });

  return {
    fatalError: null,
    rawTotal: rawItems.length,
    validItems,
    rows,
    issues,
  };
}

export default function AdminCafesImportPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status } = useAuth();

  const userRole = (user?.role ?? "").toLowerCase();
  const allowed = userRole === "admin";

  const [mode, setMode] = useState<"skip_existing" | "upsert">("skip_existing");
  const [dryRun, setDryRun] = useState(true);
  const [partialImportEnabled, setPartialImportEnabled] = useState(false);
  const [jsonText, setJsonText] = useState(sampleJSON);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdminCafeImportResponse | null>(null);
  const [lastClientSkippedInvalid, setLastClientSkippedInvalid] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const preview = useMemo(() => buildPreview(jsonText), [jsonText]);

  const previewIssuesForDownload = useMemo<PreviewIssue[]>(
    () => preview.issues.map((issue) => ({ index: issue.index, field: issue.field, message: issue.message })),
    [preview.issues],
  );

  const backendIssuesForDownload = useMemo<PreviewIssue[]>(
    () =>
      (result?.issues ?? []).map((issue) => ({
        index: issue.index,
        field: issue.field,
        message: issue.message,
      })),
    [result?.issues],
  );

  const downloadIssuesJSON = (scope: "preview" | "backend", issues: PreviewIssue[]) => {
    const payload = {
      scope,
      generated_at: new Date().toISOString(),
      issues,
    };
    downloadTextFile(
      `cafes-import-${scope}-issues-${Date.now()}.json`,
      "application/json",
      `${JSON.stringify(payload, null, 2)}\n`,
    );
  };

  const downloadIssuesCSV = (scope: "preview" | "backend", issues: PreviewIssue[]) => {
    downloadTextFile(
      `cafes-import-${scope}-issues-${Date.now()}.csv`,
      "text/csv;charset=utf-8",
      `${issuesToCSV(issues)}\n`,
    );
  };


  const handleLoadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      setJsonText(text);
      notifications.show({
        color: "green",
        title: "JSON загружен",
        message: `Файл ${file.name} подставлен в поле импорта.`,
      });
    } catch {
      notifications.show({
        color: "red",
        title: "Ошибка",
        message: "Не удалось прочитать JSON-файл.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (preview.fatalError) {
      notifications.show({
        color: "red",
        title: "Невалидный JSON",
        message: preview.fatalError,
      });
      return;
    }

    if (preview.rawTotal === 0) {
      notifications.show({
        color: "red",
        title: "Пустой список",
        message: "Добавьте хотя бы одну кофейню в JSON.",
      });
      return;
    }

    if (preview.issues.length > 0 && !partialImportEnabled) {
      notifications.show({
        color: "orange",
        title: "Есть ошибки в JSON",
        message: "Исправьте ошибки в предпроверке или включите режим импорта только валидных строк.",
      });
      return;
    }

    if (preview.validItems.length === 0) {
      notifications.show({
        color: "red",
        title: "Нет валидных строк",
        message: "Для импорта нужна хотя бы одна валидная строка.",
      });
      return;
    }

    setLoading(true);
    try {
      const skippedInvalidCount = Math.max(preview.rawTotal - preview.validItems.length, 0);
      setLastClientSkippedInvalid(skippedInvalidCount);
      const response = await importAdminCafesJSON({
        mode,
        dry_run: dryRun,
        cafes: preview.validItems,
      });
      setResult(response);
      notifications.show({
        color: "green",
        title: dryRun ? "Проверка завершена" : "Импорт завершен",
        message:
          skippedInvalidCount > 0
            ? `Обработано валидных: ${response.summary.total}. Локально пропущено невалидных: ${skippedInvalidCount}.`
            : `Обработано: ${response.summary.total}. Создано: ${response.summary.created}.`,
      });
    } catch (error: unknown) {
      notifications.show({
        color: "red",
        title: "Ошибка импорта",
        message: extractApiErrorMessage(error, "Не удалось импортировать кофейни."),
      });
    } finally {
      setLoading(false);
    }
  };

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
          <Text c="dimmed">Эта страница доступна только администраторам.</Text>
          <Button onClick={() => void navigate("/settings")}>Назад</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Box className="page-shell" pb="xl">
      <Container size="lg" py="md">
        <Stack gap="md">
          <Group justify="space-between">
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
              <Title order={3}>Импорт кофеен из JSON</Title>
            </Group>
            <Group>
              <Button variant="secondary" onClick={() => void navigate("/admin/cafes/manage")}>
                Управление кофейнями
              </Button>
              <Button variant="secondary" onClick={() => setJsonText(sampleJSON)}>
                Подставить пример
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Загрузить .json
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(event) => void handleLoadFile(event)}
              />
            </Group>
          </Group>

          <Alert icon={<IconInfoCircle size={16} />} color="blue">
            Фото не загружаются. Импортирует только данные кофейни: name, address, latitude, longitude, description и amenities.
          </Alert>

          {preview.fatalError && (
            <Alert color="red" title="Ошибка формата JSON">
              {preview.fatalError}
            </Alert>
          )}

          <Group align="end">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Select
                label="Режим дубликатов"
                data={[
                  { value: "skip_existing", label: "skip_existing (пропускать)" },
                  { value: "upsert", label: "upsert (обновлять)" },
                ]}
                value={mode}
                onChange={(value) => setMode(value === "upsert" ? "upsert" : "skip_existing")}
              />
            </Box>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Switch
                label="Dry run (без записи в БД)"
                checked={dryRun}
                onChange={(event) => setDryRun(event.currentTarget.checked)}
              />
            </Box>
          </Group>
          <Switch
            label="Импортировать только валидные строки (невалидные пропускать локально)"
            checked={partialImportEnabled}
            onChange={(event) => setPartialImportEnabled(event.currentTarget.checked)}
          />

          <Textarea
            label="JSON для импорта"
            minRows={14}
            autosize
            value={jsonText}
            onChange={(event) => setJsonText(event.currentTarget.value)}
            placeholder='[{ "name": "...", "address": "...", "latitude": 0, "longitude": 0 }]'
          />

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Всего строк: {preview.rawTotal}. Валидных: {preview.validItems.length}. Ошибок: {preview.issues.length}
            </Text>
            <Button
              loading={loading}
              disabled={
                Boolean(preview.fatalError) ||
                preview.rawTotal === 0 ||
                preview.validItems.length === 0 ||
                (preview.issues.length > 0 && !partialImportEnabled)
              }
              onClick={() => void handleImport()}
            >
              {dryRun ? "Проверить импорт" : "Импортировать"}
            </Button>
          </Group>

          {preview.issues.length > 0 && (
            <Group>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadIssuesJSON("preview", previewIssuesForDownload)}
              >
                Скачать ошибки предпроверки (JSON)
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadIssuesCSV("preview", previewIssuesForDownload)}
              >
                Скачать ошибки предпроверки (CSV)
              </Button>
            </Group>
          )}

          {preview.rows.length > 0 && (
            <Box>
              <Text fw={600} size="sm" style={{ marginBottom: 6 }}>
                Предпросмотр перед импортом (первые {Math.min(preview.rows.length, maxPreviewRows)} строк)
              </Text>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Статус</Table.Th>
                    <Table.Th>Название</Table.Th>
                    <Table.Th>Адрес</Table.Th>
                    <Table.Th>Комментарий</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {preview.rows.slice(0, maxPreviewRows).map((row) => (
                    <Table.Tr key={`preview-${row.index}`}>
                      <Table.Td>{row.index}</Table.Td>
                      <Table.Td>
                        <Text size="sm" c={row.status === "ok" ? "green" : "red"}>
                          {row.status}
                        </Text>
                      </Table.Td>
                      <Table.Td>{row.name || "—"}</Table.Td>
                      <Table.Td>{row.address || "—"}</Table.Td>
                      <Table.Td>{row.message}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}

          {result && (
            <Stack gap="sm">
              <Title order={4}>Результат</Title>
              <Group>
                <Text size="sm">Всего: {result.summary.total}</Text>
                <Text size="sm">Создано: {result.summary.created}</Text>
                <Text size="sm">Обновлено: {result.summary.updated}</Text>
                <Text size="sm">Пропущено: {result.summary.skipped}</Text>
                <Text size="sm">Невалидно: {result.summary.invalid}</Text>
                <Text size="sm">Ошибок: {result.summary.failed}</Text>
                {lastClientSkippedInvalid > 0 && (
                  <Text size="sm">Локально пропущено невалидных: {lastClientSkippedInvalid}</Text>
                )}
              </Group>

              {Array.isArray(result.issues) && result.issues.length > 0 && (
                <Box>
                  <Group style={{ marginBottom: 6 }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadIssuesJSON("backend", backendIssuesForDownload)}
                    >
                      Скачать ошибки backend (JSON)
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadIssuesCSV("backend", backendIssuesForDownload)}
                    >
                      Скачать ошибки backend (CSV)
                    </Button>
                  </Group>
                  <Text fw={600} size="sm" style={{ marginBottom: 6 }}>
                    Проблемы (первые {Math.min(result.issues.length, 12)}):
                  </Text>
                  <Table striped withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>#</Table.Th>
                        <Table.Th>Поле</Table.Th>
                        <Table.Th>Сообщение</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.issues.slice(0, 12).map((issue, index) => (
                        <Table.Tr key={`${issue.index}-${issue.field ?? ""}-${index}`}>
                          <Table.Td>{issue.index}</Table.Td>
                          <Table.Td>{issue.field ?? "—"}</Table.Td>
                          <Table.Td>{issue.message}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Box>
              )}

              <Box>
                <Text fw={600} size="sm" style={{ marginBottom: 6 }}>
                  Последние статусы:
                </Text>
                <Table striped withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Статус</Table.Th>
                      <Table.Th>Название</Table.Th>
                      <Table.Th>Сообщение</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {result.results.slice(-12).map((row) => (
                      <Table.Tr key={`${row.index}-${row.status}-${row.name}`}>
                        <Table.Td>{row.index}</Table.Td>
                        <Table.Td>{row.status}</Table.Td>
                        <Table.Td>{row.name}</Table.Td>
                        <Table.Td>{row.message ?? "—"}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
