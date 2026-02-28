import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Select,
  Stack,
  Table, 
  TextInput, 
} from "../features/admin/ui";
import { notifications } from "../lib/notifications";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import {
  listAdminFeedback,
  type AdminFeedbackItem,
} from "../api/adminFeedback";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";

const LIMIT_OPTIONS = [
  { value: "20", label: "20" },
  { value: "30", label: "30" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];

function formatFeedbackDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderUserLabel(item: AdminFeedbackItem): string {
  if (item.user_display_name?.trim()) {
    if (item.user_email?.trim()) {
      return `${item.user_display_name} (${item.user_email})`;
    }
    return item.user_display_name;
  }
  if (item.user_email?.trim()) {
    return item.user_email;
  }
  return item.user_id;
}

export default function AdminFeedbackPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const role = (user?.role ?? "").toLowerCase();
  const allowed = role === "admin";

  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState<AdminFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const result = await listAdminFeedback({
        q: query,
        limit,
        offset,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error: unknown) {
      notifications.show({
        color: "red",
        title: "Ошибка",
        message: extractApiErrorMessage(error, "Не удалось загрузить отзывы."),
      });
    } finally {
      setLoading(false);
    }
  }, [allowed, limit, offset, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;
  const from = total === 0 ? 0 : offset + 1;
  const to = total === 0 ? 0 : offset + items.length;
  const pageLabel = useMemo(() => {
    if (total === 0) return "Нет отзывов";
    return `Показано ${from}-${to} из ${total}`;
  }, [from, to, total]);

  if (status === "loading") {
    return (
      <Box style={{ padding: 20 }}>
        <p className="m-0 text-sm text-text">Загрузка...</p>
      </Box>
    );
  }

  if (!allowed) {
    return (
      <Container style={{ maxWidth: 640,  paddingTop: 24, paddingBottom: 24 }}>
        <Stack style={{ gap: 16 }}>
          <h3 className="m-0 text-2xl font-bold text-text">Доступ ограничен</h3>
          <p style={{ margin: 0,  color: "var(--muted)" }}>
            Эта страница доступна только администраторам.
          </p>
          <Button onClick={() => void navigate("/settings")}>Назад</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Box className="page-shell" style={{ paddingBottom: 24 }}>
      <Container style={{ maxWidth: 1080,  paddingTop: 16, paddingBottom: 16 }}>
        <Stack style={{ gap: 16 }}>
          <Group justify="space-between" align="center">
            <Group>
              <ActionIcon
                size={42}
                className="glass-action glass-action--square"
                onClick={() => void navigate("/settings")}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <h3 className="m-0 text-2xl font-bold text-text">Отзывы о приложении</h3>
            </Group>
            <Button variant="secondary" onClick={() => void load()} loading={loading}>
              Обновить
            </Button>
          </Group>

          <Paper style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
            <Stack style={{ gap: 12 }}>
              <Group>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <TextInput
                    label="Поиск"
                    placeholder="Текст отзыва, контакт, email, имя"
                    value={queryDraft}
                    onChange={(event) => setQueryDraft(event.currentTarget.value)}
                  />
                </Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Select
                    label="Лимит"
                    data={LIMIT_OPTIONS}
                    value={String(limit)}
                    onChange={(value) => {
                      const next = Number(value ?? "30");
                      setLimit(Number.isFinite(next) && next > 0 ? next : 30);
                      setOffset(0);
                    }}
                  />
                </Box>
              </Group>
              <Group justify="space-between">
                <p style={{ margin: 0,  fontSize: 13, color: "var(--muted)" }}>{pageLabel}</p>
                <Group style={{ gap: 8 }}>
                  <Button
                    variant="default"
                    disabled={loading || !hasPrev}
                    onClick={() => {
                      setOffset((prev) => Math.max(0, prev - limit));
                    }}
                  >
                    Назад
                  </Button>
                  <Button
                    variant="default"
                    disabled={loading || !hasNext}
                    onClick={() => {
                      setOffset((prev) => prev + limit);
                    }}
                  >
                    Вперед
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={loading}
                    onClick={() => {
                      setOffset(0);
                      setQuery(queryDraft.trim());
                    }}
                  >
                    Применить
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Paper>

          <Paper style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ minWidth: 146 }}>Дата</Table.Th>
                  <Table.Th style={{ minWidth: 210 }}>Пользователь</Table.Th>
                  <Table.Th style={{ minWidth: 180 }}>Контакт</Table.Th>
                  <Table.Th>Отзыв</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{formatFeedbackDate(item.created_at)}</Table.Td>
                    <Table.Td>{renderUserLabel(item)}</Table.Td>
                    <Table.Td>{item.contact || "—"}</Table.Td>
                    <Table.Td>
                      <p style={{ margin: 0,  whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{item.message}</p>
                      {item.user_agent && (
                        <p style={{ margin: 0,  fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                          UA: {item.user_agent}
                        </p>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {items.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4}>
                      <p style={{ margin: 0,  color: "var(--muted)" }}>Отзывы не найдены.</p>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
