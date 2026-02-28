import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "../features/admin/ui";
import { notifications } from "../lib/notifications";
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
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
import { extractApiErrorMessage } from "../utils/apiError";

const CafeDetailsScreen = lazy(() => import("../features/discovery/ui/details/CafeDetailsScreen"));

const STATUS_META: Record<
  SubmissionStatus,
  { label: string; color: "yellow" | "green" | "red" | "orange" | "gray" }
> = {
  pending: { label: "В ожидании", color: "yellow" },
  approved: { label: "Одобрено", color: "green" },
  rejected: { label: "Отклонено", color: "red" },
  needs_changes: { label: "Нужны правки", color: "orange" },
  cancelled: { label: "Отменено", color: "gray" },
};

const ACTION_LABELS: Record<string, string> = {
  create: "Создание",
  update: "Обновление",
  delete: "Удаление",
};

function readPayloadString(payload: Record<string, unknown> | undefined, key: string): string | null {
  const value = payload?.[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function readPayloadNumber(payload: Record<string, unknown> | undefined, key: string): number | null {
  const value = payload?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

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
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось загрузить очередь модерации.");
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
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось одобрить заявку.");
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
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, "Не удалось отклонить заявку.");
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
      <Box style={{ padding: 20 }}>
        <Text>Загрузка...</Text>
      </Box>
    );
  }

  if (!allowed) {
    return (
      <Container size="sm" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <Stack style={{ gap: 16 }}>
          <Title order={3}>Доступ ограничен</Title>
          <Text style={{ color: "var(--muted)" }}>
            Эта страница доступна только модераторам и администраторам.
          </Text>
          <Button onClick={() => void navigate("/settings")}>Назад</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Box
      className="page-shell"
      pb="xl"
      style={{
        height: "var(--app-vh)",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Container size="sm" style={{ paddingTop: 16, paddingBottom: 16 }}>
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
              <Title order={3}>Модерация</Title>
            </Group>
            <Button variant="secondary" onClick={() => void refresh()} loading={loading}>
              Обновить
            </Button>
          </Group>

          <Paper withBorder style={{ borderRadius: 16, padding: 16 }}>
            <Stack style={{ gap: 12 }}>
              <Select
                label="Статус"
                data={STATUS_OPTIONS}
                value={filterStatus}
                onChange={(value) => setFilterStatus((value ?? "") as SubmissionStatus | "")}
              />
            </Stack>
          </Paper>

          <Paper withBorder style={{ borderRadius: 16, padding: 16 }}>
            <Box className="relative">
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
            <Paper withBorder style={{ borderRadius: 16, padding: 16 }}>
              <Text style={{ color: "var(--muted)" }}>Заявок по текущему фильтру нет.</Text>
            </Paper>
          )}

          {visibleItems.map((item) => {
            const isPending = item.status === "pending";
            const isProcessing = processingId === item.id;
            const statusMeta = STATUS_META[item.status] ?? {
              label: item.status,
              color: "gray" as const,
            };
            const actionLabel = ACTION_LABELS[item.action_type] ?? item.action_type;
            const payload = item.payload;
            const photoUrls = readStringArrayFromPayload(item.payload, "photo_urls");
            const menuPhotoUrls = readStringArrayFromPayload(item.payload, "menu_photo_urls");
            const targetCafeMapUrl = resolveTargetCafeMapUrl(item);
            const targetCafeName = item.target_cafe_name?.trim();
            const previewCandidate = buildPreviewCafe(item);
            const candidateName =
              previewCandidate?.name ??
              targetCafeName ??
              readPayloadString(payload, "name") ??
              "Без названия";
            const candidateAddress =
              previewCandidate?.address ??
              item.target_cafe_address?.trim() ??
              readPayloadString(payload, "address");
            const description = readPayloadString(payload, "description");
            const amenities = readStringArrayFromPayload(payload, "amenities");
            const reviewSummary = readPayloadString(payload, "summary");
            const reviewDrink =
              readPayloadString(payload, "drink_name") ?? readPayloadString(payload, "drink");
            const reviewRating = readPayloadNumber(payload, "rating");
            const reviewTags = readStringArrayFromPayload(payload, "taste_tags");
            return (
              <Paper key={item.id} withBorder style={{ borderRadius: 16, padding: 16 }}>
                <Stack style={{ gap: 12 }}>
                  <Group justify="space-between" align="center">
                    <Group style={{ gap: 8 }}>
                      <Badge variant="secondary">{entityLabel(item.entity_type)}</Badge>
                      <Badge variant="dot" color="gray">
                        {actionLabel}
                      </Badge>
                    </Group>
                    <Badge color={statusMeta.color}>{statusMeta.label}</Badge>
                  </Group>
                  <Text style={{ fontSize: 13, color: "var(--muted)" }}>
                    {item.author_label || item.author_user_id} • {formatModerationDate(item.created_at)}
                  </Text>

                  {(item.target_id || targetCafeName || previewCandidate) && (
                    <Paper withBorder style={{ borderRadius: 12, padding: 12, background: "var(--surface)" }}>
                      <Stack style={{ gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: 600 }}>
                          Предлагаемая кофейня
                        </Text>
                        <Group
                          justify="space-between"
                          align="flex-start"
                          wrap="nowrap"
                          style={{ gap: 8 }}
                        >
                          <Stack style={{ gap: 2, minWidth: 0 }}>
                            <Text style={{ fontSize: 13 }}>{candidateName}</Text>
                            {candidateAddress && (
                              <Text style={{ fontSize: 12, color: "var(--muted)" }} lineClamp={2}>
                                {candidateAddress}
                              </Text>
                            )}
                            {item.target_id && (
                              <Text style={{ fontSize: 12, color: "var(--muted)" }}>
                                ID: {item.target_id}
                              </Text>
                            )}
                          </Stack>
                          {targetCafeMapUrl && (
                            <Button
                              size="sm"
                              variant="secondary"
                              type="button"
                              onClick={() => {
                                window.open(targetCafeMapUrl, "_blank", "noopener,noreferrer");
                              }}
                            >
                              На карте
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Paper>
                  )}

                  {description && (
                    <Paper withBorder style={{ borderRadius: 12, padding: 12, background: "var(--surface)" }}>
                      <Stack style={{ gap: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: 600 }}>
                          {item.entity_type === "cafe_description"
                            ? "Предложенное описание"
                            : "Описание"}
                        </Text>
                        <Text style={{ fontSize: 13 }}>{description}</Text>
                      </Stack>
                    </Paper>
                  )}

                  {amenities.length > 0 && (
                    <Stack style={{ gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: 600 }}>
                        Удобства
                      </Text>
                      <Group style={{ gap: 6 }}>
                        {amenities.map((amenity) => (
                          <Badge key={`${item.id}-amenity-${amenity}`} variant="secondary" style={{ borderRadius: 10 }}>
                            {amenity}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  )}

                  {(reviewSummary || reviewDrink || reviewRating != null || reviewTags.length > 0) && (
                    <Paper withBorder style={{ borderRadius: 12, padding: 12, background: "var(--surface)" }}>
                      <Stack style={{ gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: 600 }}>
                          Данные отзыва
                        </Text>
                        <Group style={{ gap: 8 }}>
                          {reviewRating != null && (
                            <Badge variant="secondary">Оценка: {reviewRating}</Badge>
                          )}
                          {reviewDrink && (
                            <Badge variant="secondary">Напиток: {reviewDrink}</Badge>
                          )}
                        </Group>
                        {reviewTags.length > 0 && (
                          <Group style={{ gap: 6 }}>
                            {reviewTags.map((tag) => (
                              <Badge key={`${item.id}-tag-${tag}`} variant="outline" style={{ borderRadius: 10 }}>
                                {tag}
                              </Badge>
                            ))}
                          </Group>
                        )}
                        {reviewSummary && <Text style={{ fontSize: 13 }}>{reviewSummary}</Text>}
                      </Stack>
                    </Paper>
                  )}

                  {photoUrls.length > 0 && (
                    <Stack style={{ gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: 600 }}>
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
                    <Stack style={{ gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: 600 }}>
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

                  {item.moderator_comment && (
                    <Text style={{ fontSize: 13, color: "var(--muted)" }}>
                      Комментарий модератора: {item.moderator_comment}
                    </Text>
                  )}
                  {isPending && (
                    <Group>
                      <Button
                        className="flex-1"
                        onClick={() => void handleApprove(item.id)}
                        loading={isProcessing}
                      >
                        <IconCheck size={16} />
                        Одобрить
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => void handleReject(item.id)}
                        loading={isProcessing}
                      >
                        <IconX size={16} />
                        Отклонить
                      </Button>
                    </Group>
                  )}
                  {previewCandidate && (
                    <Button
                      className="mt-2 w-full"
                      variant="secondary"
                      onClick={() => {
                        setPreviewCafe(previewCandidate);
                        setPreviewOpen(true);
                      }}
                    >
                      Предпросмотр карточки кофейни
                    </Button>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {previewOpen && (
          <Suspense fallback={null}>
            <CafeDetailsScreen
              opened={previewOpen}
              cafe={previewCafe}
              onClose={() => setPreviewOpen(false)}
              showDistance={false}
              showRoutes={false}
            />
          </Suspense>
        )}
      </Container>
    </Box>
  );
}
