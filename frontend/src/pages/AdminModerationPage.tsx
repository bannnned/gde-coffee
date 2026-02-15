import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import {
  approveModerationSubmission,
  listModerationSubmissions,
  rejectModerationSubmission,
  type ModerationSubmission,
  type SubmissionEntityType,
  type SubmissionStatus,
} from "../api/submissions";

const STATUS_OPTIONS: { value: SubmissionStatus | ""; label: string }[] = [
  { value: "pending", label: "В ожидании" },
  { value: "approved", label: "Одобрено" },
  { value: "rejected", label: "Отклонено" },
  { value: "needs_changes", label: "Нужны правки" },
  { value: "cancelled", label: "Отменено" },
  { value: "", label: "Все статусы" },
];

const ENTITY_OPTIONS: { value: SubmissionEntityType | ""; label: string }[] = [
  { value: "", label: "Все типы" },
  { value: "cafe", label: "Новая кофейня" },
  { value: "cafe_description", label: "Описание" },
  { value: "cafe_photo", label: "Фото заведения" },
  { value: "menu_photo", label: "Фото меню" },
  { value: "review", label: "Отзыв" },
];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminModerationPage() {
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const role = (user?.role ?? "").toLowerCase();
  const allowed = role === "admin" || role === "moderator";

  const [items, setItems] = useState<ModerationSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | "pending" | "">(
    "pending",
  );
  const [filterEntity, setFilterEntity] = useState<SubmissionEntityType | "">("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const list = await listModerationSubmissions({
        status: filterStatus,
        entityType: filterEntity,
      });
      setItems(list);
    } catch (err: any) {
      const message =
        err?.normalized?.message ??
        err?.response?.data?.message ??
        "Не удалось загрузить очередь модерации.";
      notifications.show({
        color: "red",
        title: "Ошибка",
        message,
      });
    } finally {
      setLoading(false);
    }
  }, [allowed, filterEntity, filterStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const entityLabel = useMemo(() => {
    const map = new Map(ENTITY_OPTIONS.map((item) => [item.value, item.label]));
    return (entity: string) => map.get(entity) ?? entity;
  }, []);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await approveModerationSubmission(id);
      notifications.show({
        color: "green",
        title: "Одобрено",
        message: "Заявка подтверждена.",
      });
      await refresh();
    } catch (err: any) {
      const message =
        err?.normalized?.message ??
        err?.response?.data?.message ??
        "Не удалось одобрить заявку.";
      notifications.show({
        color: "red",
        title: "Ошибка",
        message,
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const comment = window.prompt("Причина отклонения");
    if (!comment || !comment.trim()) return;
    setProcessingId(id);
    try {
      await rejectModerationSubmission(id, comment.trim());
      notifications.show({
        color: "green",
        title: "Отклонено",
        message: "Заявка отклонена.",
      });
      await refresh();
    } catch (err: any) {
      const message =
        err?.normalized?.message ??
        err?.response?.data?.message ??
        "Не удалось отклонить заявку.";
      notifications.show({
        color: "red",
        title: "Ошибка",
        message,
      });
    } finally {
      setProcessingId(null);
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
          <Text c="dimmed">
            Эта страница доступна только модераторам и администраторам.
          </Text>
          <Button onClick={() => navigate("/settings")}>Назад</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Box className="page-shell" pb="xl">
      <Container size="sm" py="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Group>
              <ActionIcon
                size={42}
                variant="transparent"
                className="glass-action glass-action--square"
                onClick={() => navigate("/settings")}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Title order={3}>Модерация</Title>
            </Group>
            <Button variant="light" onClick={() => void refresh()} loading={loading}>
              Обновить
            </Button>
          </Group>

          <Paper withBorder radius="lg" p="md">
            <Stack gap="sm">
              <Select
                label="Статус"
                data={STATUS_OPTIONS}
                value={filterStatus}
                onChange={(value) => setFilterStatus((value ?? "") as SubmissionStatus | "")}
              />
              <Select
                label="Тип заявки"
                data={ENTITY_OPTIONS}
                value={filterEntity}
                onChange={(value) =>
                  setFilterEntity((value ?? "") as SubmissionEntityType | "")
                }
              />
            </Stack>
          </Paper>

          {items.length === 0 && !loading && (
            <Paper withBorder radius="lg" p="md">
              <Text c="dimmed">Заявок по текущему фильтру нет.</Text>
            </Paper>
          )}

          {items.map((item) => {
            const isPending = item.status === "pending";
            const isProcessing = processingId === item.id;
            return (
              <Paper key={item.id} withBorder radius="lg" p="md">
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Badge variant="light">{entityLabel(item.entity_type)}</Badge>
                    <Badge color={isPending ? "yellow" : item.status === "approved" ? "green" : "red"}>
                      {item.status}
                    </Badge>
                  </Group>
                  <Text size="sm">
                    Автор: {item.author_label || item.author_user_id}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Создано: {formatDate(item.created_at)}
                  </Text>
                  {item.target_id && (
                    <Text size="sm" c="dimmed">
                      Цель: {item.target_id}
                    </Text>
                  )}
                  <Paper withBorder radius="md" p="xs" style={{ background: "var(--surface)" }}>
                    <Text
                      component="pre"
                      size="xs"
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(item.payload ?? {}, null, 2)}
                    </Text>
                  </Paper>
                  {item.moderator_comment && (
                    <Text size="sm" c="dimmed">
                      Комментарий модератора: {item.moderator_comment}
                    </Text>
                  )}
                  {isPending && (
                    <Group grow>
                      <Button
                        leftSection={<IconCheck size={16} />}
                        onClick={() => void handleApprove(item.id)}
                        loading={isProcessing}
                      >
                        Одобрить
                      </Button>
                      <Button
                        color="red"
                        variant="light"
                        leftSection={<IconX size={16} />}
                        onClick={() => void handleReject(item.id)}
                        loading={isProcessing}
                      >
                        Отклонить
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Container>
    </Box>
  );
}
