import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import CafeDetailsScreen from "../features/discovery/ui/details/CafeDetailsScreen";
import type { Cafe } from "../types";
import {
  buildPreviewCafe,
  formatModerationDate,
  getModerationEntityLabel,
  type ModerationTabKey,
  readStringArrayFromPayload,
  resolveTargetCafeMapUrl,
  STATUS_OPTIONS,
  TAB_ITEMS,
} from "../features/moderation/model/submissionView";
import {
  approveModerationSubmission,
  listModerationSubmissions,
  rejectModerationSubmission,
  type ModerationSubmission,
  type SubmissionStatus,
} from "../api/submissions";

export default function AdminModerationPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const role = (user?.role ?? "").toLowerCase();
  const allowed = role === "admin" || role === "moderator";

  const [items, setItems] = useState<ModerationSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | "pending" | "">(
    "pending",
  );
  const [activeTab, setActiveTab] = useState<ModerationTabKey>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewCafe, setPreviewCafe] = useState<Cafe | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const [tabsFade, setTabsFade] = useState({ left: false, right: false });

  const refresh = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const list = await listModerationSubmissions({
        status: filterStatus,
        entityType: "",
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
  }, [allowed, filterStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const entityLabel = useMemo(() => getModerationEntityLabel, []);

  const visibleItems = useMemo(() => {
    if (activeTab === "all") return items;
    return items.filter((item) => item.entity_type === activeTab);
  }, [activeTab, items]);

  const tabCounts = useMemo(() => {
    const counts: Record<ModerationTabKey, number> = {
      all: items.length,
      cafe: 0,
      cafe_description: 0,
      cafe_photo: 0,
      menu_photo: 0,
      review: 0,
    };
    for (const item of items) {
      const key = item.entity_type as ModerationTabKey;
      if (key in counts) {
        counts[key] += 1;
      }
    }
    return counts;
  }, [items]);

  const tabsData = useMemo(
    () =>
      TAB_ITEMS.map((tab) => ({
        value: tab.value,
        label: `${tab.label} (${tabCounts[tab.value] ?? 0})`,
      })),
    [tabCounts],
  );

  const updateTabsFade = useCallback(() => {
    const node = tabsScrollRef.current;
    if (!node) {
      setTabsFade({ left: false, right: false });
      return;
    }
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const left = node.scrollLeft > 2;
    const right = node.scrollLeft < maxScrollLeft - 2;
    setTabsFade((prev) => {
      if (prev.left === left && prev.right === right) return prev;
      return { left, right };
    });
  }, []);

  useEffect(() => {
    const node = tabsScrollRef.current;
    if (!node) return;

    updateTabsFade();
    const onScroll = () => updateTabsFade();
    node.addEventListener("scroll", onScroll, { passive: true });

    const observer = new ResizeObserver(() => updateTabsFade());
    observer.observe(node);
    if (node.firstElementChild instanceof HTMLElement) {
      observer.observe(node.firstElementChild);
    }

    window.addEventListener("resize", updateTabsFade);
    return () => {
      node.removeEventListener("scroll", onScroll);
      observer.disconnect();
      window.removeEventListener("resize", updateTabsFade);
    };
  }, [tabsData, updateTabsFade]);

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
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" p="md">
            <Box pos="relative">
              <Box
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 24,
                  pointerEvents: "none",
                  zIndex: 2,
                  opacity: tabsFade.left ? 1 : 0,
                  transition: "opacity 180ms ease",
                  background:
                    "linear-gradient(90deg, color-mix(in srgb, var(--surface) 88%, transparent), transparent)",
                }}
              />
              <Box
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 24,
                  pointerEvents: "none",
                  zIndex: 2,
                  opacity: tabsFade.right ? 1 : 0,
                  transition: "opacity 180ms ease",
                  background:
                    "linear-gradient(270deg, color-mix(in srgb, var(--surface) 88%, transparent), transparent)",
                }}
              />
              <Box
                ref={tabsScrollRef}
              style={{
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "thin",
              }}
            >
              <SegmentedControl
                fullWidth={false}
                value={activeTab}
                onChange={(value) => setActiveTab((value as ModerationTabKey) ?? "all")}
                data={tabsData}
                styles={{
                  root: {
                    width: "max-content",
                    minWidth: "100%",
                    background:
                      "linear-gradient(135deg, var(--glass-grad-hover-1), var(--glass-grad-hover-2))",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--glass-shadow)",
                    backdropFilter: "blur(14px) saturate(140%)",
                    WebkitBackdropFilter: "blur(14px) saturate(140%)",
                    transition: "background 220ms ease, box-shadow 220ms ease",
                  },
                  indicator: {
                    background:
                      "linear-gradient(135deg, var(--color-brand-accent), var(--color-brand-accent-strong))",
                    border: "1px solid var(--color-border-soft)",
                    boxShadow: "0 6px 16px var(--color-brand-accent-soft)",
                    transition: "all 220ms ease",
                  },
                  label: {
                    color: "var(--text)",
                    fontWeight: 600,
                    transition: "color 180ms ease",
                    whiteSpace: "nowrap",
                  },
                }}
              />
            </Box>
            </Box>
          </Paper>

          {visibleItems.length === 0 && !loading && (
            <Paper withBorder radius="lg" p="md">
              <Text c="dimmed">Заявок по текущему фильтру нет.</Text>
            </Paper>
          )}

          {visibleItems.map((item) => {
            const isPending = item.status === "pending";
            const isProcessing = processingId === item.id;
            const photoUrls = readStringArrayFromPayload(item.payload, "photo_urls");
            const menuPhotoUrls = readStringArrayFromPayload(item.payload, "menu_photo_urls");
            const targetCafeMapUrl = resolveTargetCafeMapUrl(item);
            const targetCafeName = item.target_cafe_name?.trim();
            const previewCandidate = buildPreviewCafe(item);
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
                    Создано: {formatModerationDate(item.created_at)}
                  </Text>
                  {(item.target_id || targetCafeName) && (
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Text size="sm">
                          Кофейня: {targetCafeName || "Без названия"}
                        </Text>
                        {item.target_cafe_address && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {item.target_cafe_address}
                          </Text>
                        )}
                        {item.target_id && (
                          <Text size="xs" c="dimmed">
                            ID: {item.target_id}
                          </Text>
                        )}
                      </Stack>
                      {targetCafeMapUrl && (
                        <Button
                          size="xs"
                          variant="light"
                          component="a"
                          href={targetCafeMapUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Открыть карту
                        </Button>
                      )}
                    </Group>
                  )}

                  {photoUrls.length > 0 && (
                    <Stack gap={6}>
                      <Text size="sm" fw={600}>
                        Фото заявки
                      </Text>
                      <Box
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 8,
                        }}
                      >
                        {photoUrls.map((url, index) => (
                          <Paper
                            key={`${item.id}-photo-${index}`}
                            withBorder
                            radius="sm"
                            style={{ overflow: "hidden" }}
                          >
                            <img
                              src={url}
                              alt={`Фото заявки ${index + 1}`}
                              loading="lazy"
                              style={{
                                width: "100%",
                                aspectRatio: "4 / 3",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          </Paper>
                        ))}
                      </Box>
                    </Stack>
                  )}

                  {menuPhotoUrls.length > 0 && (
                    <Stack gap={6}>
                      <Text size="sm" fw={600}>
                        Фото меню
                      </Text>
                      <Box
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 8,
                        }}
                      >
                        {menuPhotoUrls.map((url, index) => (
                          <Paper
                            key={`${item.id}-menu-${index}`}
                            withBorder
                            radius="sm"
                            style={{ overflow: "hidden" }}
                          >
                            <img
                              src={url}
                              alt={`Фото меню ${index + 1}`}
                              loading="lazy"
                              style={{
                                width: "100%",
                                aspectRatio: "4 / 3",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          </Paper>
                        ))}
                      </Box>
                    </Stack>
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
                  {previewCandidate && (
                    <Button
                      mt="xs"
                      variant="light"
                      fullWidth
                      onClick={() => {
                        setPreviewCafe(previewCandidate);
                        setPreviewOpen(true);
                      }}
                    >
                      Открыть кофейню
                    </Button>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        <CafeDetailsScreen
          opened={previewOpen}
          cafe={previewCafe}
          onClose={() => setPreviewOpen(false)}
          showDistance={false}
          showRoutes={false}
        />
      </Container>
    </Box>
  );
}
