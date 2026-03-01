import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ActionIcon,
  Button,
} from "../features/admin/ui";
import { notifications } from "../lib/notifications";
import { IconArrowLeft, IconCheck, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { AppSelect } from "../ui/bridge";

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

type InlineBadgeVariant = "default" | "secondary" | "outline" | "dot";
type InlineBadgeTone = "yellow" | "green" | "red" | "orange" | "gray";

function inlineBadgeTone(color?: InlineBadgeTone): string {
  if (color === "green") return "var(--color-status-success)";
  if (color === "red") return "var(--color-status-error)";
  if (color === "orange" || color === "yellow") return "var(--color-status-warning)";
  return "color-mix(in srgb, var(--muted) 45%, var(--surface))";
}

function InlineBadge({
  children,
  variant = "default",
  color,
  style,
}: {
  children?: ReactNode;
  variant?: InlineBadgeVariant;
  color?: InlineBadgeTone;
  style?: CSSProperties;
}) {
  const tone = inlineBadgeTone(color);
  const isSoft = variant === "secondary" || variant === "dot";
  const isSolid = variant === "default";
  const isLowContrastTone = color === "yellow" || color === "gray";
  const textColor = isSolid
    ? isLowContrastTone
      ? "var(--text)"
      : "var(--color-on-accent)"
    : "var(--text)";
  const background =
    variant === "outline"
      ? "transparent"
      : isSoft
        ? "color-mix(in srgb, var(--surface) 72%, transparent)"
        : tone;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: variant === "dot" ? 6 : 0,
        borderRadius: 999,
        border: `1px solid ${tone}`,
        background,
        color: textColor,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 8px",
        ...style,
      }}
    >
      {variant === "dot" ? (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: tone,
            display: "inline-block",
          }}
        />
      ) : null}
      {children}
    </span>
  );
}

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
            Эта страница доступна только модераторам и администраторам.
          </p>
          <Button onClick={() => void navigate("/settings")}>Назад</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-shell"
      style={{
        paddingBottom: 24,
        height: "var(--app-vh)",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{ maxWidth: 640, marginInline: "auto", paddingTop: 16, paddingBottom: 16 }}>
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
              <h3 className="m-0 text-2xl font-bold text-text">Модерация</h3>
            </div>
            <Button variant="secondary" onClick={() => void refresh()} loading={loading}>
              Обновить
            </Button>
          </div>

          <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Статус</span>
                <AppSelect
                  implementation="radix"
                  data={STATUS_OPTIONS}
                  value={filterStatus}
                  onChange={(value) => setFilterStatus((value ?? "") as SubmissionStatus | "")}
                />
              </label>
            </div>
          </div>

          <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
            <div className="relative">
              <div
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
              <div
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
              <div
                ref={tabsScrollRef}
              style={{
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "thin",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "max-content",
                  minWidth: "100%",
                  padding: 4,
                  borderRadius: 12,
                  border: "1px solid var(--glass-border)",
                  background:
                    "linear-gradient(135deg, var(--glass-grad-hover-1), var(--glass-grad-hover-2))",
                  boxShadow: "var(--glass-shadow)",
                  backdropFilter: "blur(14px) saturate(140%)",
                  WebkitBackdropFilter: "blur(14px) saturate(140%)",
                  transition: "background 220ms ease, box-shadow 220ms ease",
                }}
              >
                {tabsData.map((item) => {
                  const active = item.value === activeTab;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className="ui-focus-ring"
                      onClick={() => setActiveTab((item.value as ModerationTabKey) ?? "all")}
                      style={{
                        border: active
                          ? "1px solid var(--color-border-soft)"
                          : "1px solid transparent",
                        background: active
                          ? "linear-gradient(135deg, var(--color-brand-accent), var(--color-brand-accent-strong))"
                          : "transparent",
                        color: "var(--text)",
                        fontWeight: 600,
                        transition: "all 220ms ease",
                        whiteSpace: "nowrap",
                        borderRadius: 10,
                        padding: "8px 10px",
                        cursor: "pointer",
                        boxShadow: active
                          ? "0 6px 16px var(--color-brand-accent-soft)"
                          : "none",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            </div>
          </div>

          {visibleItems.length === 0 && !loading && (
            <div style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
              <p style={{ margin: 0,  color: "var(--muted)" }}>Заявок по текущему фильтру нет.</p>
            </div>
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
              <div key={item.id} style={{ border: "1px solid var(--border)",  borderRadius: 16, padding: 16 }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <InlineBadge variant="secondary">{entityLabel(item.entity_type)}</InlineBadge>
                      <InlineBadge variant="dot" color="gray">
                        {actionLabel}
                      </InlineBadge>
                    </div>
                    <InlineBadge color={statusMeta.color}>{statusMeta.label}</InlineBadge>
                  </div>
                  <p style={{ margin: 0,  fontSize: 13, color: "var(--muted)" }}>
                    {item.author_label || item.author_user_id} • {formatModerationDate(item.created_at)}
                  </p>

                  {(item.target_id || targetCafeName || previewCandidate) && (
                    <div style={{ border: "1px solid var(--border)",  borderRadius: 12, padding: 12, background: "var(--surface)" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <p style={{ margin: 0,  fontSize: 13, fontWeight: 600 }}>
                          Предлагаемая кофейня
                        </p>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "nowrap",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 8,
                          }}
                        >
                          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                            <p style={{ margin: 0,  fontSize: 13 }}>{candidateName}</p>
                            {candidateAddress && (
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: "var(--muted)",
                                  display: "-webkit-box",
                                  WebkitBoxOrient: "vertical",
                                  WebkitLineClamp: 2,
                                  overflow: "hidden",
                                }}
                              >
                                {candidateAddress}
                              </p>
                            )}
                            {item.target_id && (
                              <p style={{ margin: 0,  fontSize: 12, color: "var(--muted)" }}>
                                ID: {item.target_id}
                              </p>
                            )}
                          </div>
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
                        </div>
                      </div>
                    </div>
                  )}

                  {description && (
                    <div style={{ border: "1px solid var(--border)",  borderRadius: 12, padding: 12, background: "var(--surface)" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <p style={{ margin: 0,  fontSize: 13, fontWeight: 600 }}>
                          {item.entity_type === "cafe_description"
                            ? "Предложенное описание"
                            : "Описание"}
                        </p>
                        <p style={{ margin: 0,  fontSize: 13 }}>{description}</p>
                      </div>
                    </div>
                  )}

                  {amenities.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <p style={{ margin: 0,  fontSize: 13, fontWeight: 600 }}>
                        Удобства
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {amenities.map((amenity) => (
                          <InlineBadge key={`${item.id}-amenity-${amenity}`} variant="secondary" style={{ borderRadius: 10 }}>
                            {amenity}
                          </InlineBadge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(reviewSummary || reviewDrink || reviewRating != null || reviewTags.length > 0) && (
                    <div style={{ border: "1px solid var(--border)",  borderRadius: 12, padding: 12, background: "var(--surface)" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <p style={{ margin: 0,  fontSize: 13, fontWeight: 600 }}>
                          Данные отзыва
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {reviewRating != null && (
                            <InlineBadge variant="secondary">Оценка: {reviewRating}</InlineBadge>
                          )}
                          {reviewDrink && (
                            <InlineBadge variant="secondary">Напиток: {reviewDrink}</InlineBadge>
                          )}
                        </div>
                        {reviewTags.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {reviewTags.map((tag) => (
                              <InlineBadge key={`${item.id}-tag-${tag}`} variant="outline" style={{ borderRadius: 10 }}>
                                {tag}
                              </InlineBadge>
                            ))}
                          </div>
                        )}
                        {reviewSummary && <p style={{ margin: 0,  fontSize: 13 }}>{reviewSummary}</p>}
                      </div>
                    </div>
                  )}

                  {photoUrls.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <p style={{ margin: 0,  fontSize: 13, fontWeight: 600 }}>
                        Фото заявки
                      </p>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 8,
                        }}
                      >
                        {photoUrls.map((url, index) => (
                          <div
                            key={`${item.id}-photo-${index}`}
                            style={{
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              overflow: "hidden",
                            }}
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {menuPhotoUrls.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <p style={{ margin: 0,  fontSize: 13, fontWeight: 600 }}>
                        Фото меню
                      </p>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 8,
                        }}
                      >
                        {menuPhotoUrls.map((url, index) => (
                          <div
                            key={`${item.id}-menu-${index}`}
                            style={{
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              overflow: "hidden",
                            }}
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.moderator_comment && (
                    <p style={{ margin: 0,  fontSize: 13, color: "var(--muted)" }}>
                      Комментарий модератора: {item.moderator_comment}
                    </p>
                  )}
                  {isPending && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
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
                    </div>
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
                </div>
              </div>
            );
          })}
        </div>

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
      </div>
    </div>
  );
}
