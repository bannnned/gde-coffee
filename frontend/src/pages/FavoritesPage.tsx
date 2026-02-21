import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconHeartFilled } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { listFavoriteCafes, removeCafeFromFavorites } from "../api/favorites";
import type { Cafe } from "../entities/cafe/model/types";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";

const CafeDetailsScreen = lazy(() => import("../features/discovery/ui/details/CafeDetailsScreen"));

type FavoritesErrorLike = {
  normalized?: {
    message?: string;
  };
  response?: {
    data?: {
      message?: string;
    };
  };
};

function extractFavoritesErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const err = error as FavoritesErrorLike;
  return err.normalized?.message ?? err.response?.data?.message ?? fallback;
}

export default function FavoritesPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status, openAuthModal } = useAuth();
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyCafeId, setBusyCafeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const title = useMemo(
    () => (cafes.length === 1 ? "1 кофейня" : `${cafes.length} кофеен`),
    [cafes.length],
  );

  useEffect(() => {
    if (status === "loading") return;
    if (!user) {
      openAuthModal("login");
      void navigate("/profile", { replace: true });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listFavoriteCafes()
      .then((items) => {
        if (cancelled) return;
        setCafes(items);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = extractFavoritesErrorMessage(
          error,
          "Не удалось загрузить избранные кофейни.",
        );
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, openAuthModal, status, user]);

  const handleRemove = async (cafeId: string) => {
    if (busyCafeId) return;
    setBusyCafeId(cafeId);
    setError(null);
    try {
      await removeCafeFromFavorites(cafeId);
      setCafes((prev) => prev.filter((item) => item.id !== cafeId));
    } catch (error: unknown) {
      const message = extractFavoritesErrorMessage(error, "Не удалось обновить избранное.");
      setError(message);
    } finally {
      setBusyCafeId(null);
    }
  };

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
                onClick={() => {
                  void navigate("/profile");
                }}
                aria-label="Назад"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
              <Title order={3}>Избранные</Title>
            </Group>
            <Group gap="xs" align="center">
              <Text c="dimmed" size="sm">
                {title}
              </Text>
              <ActionIcon
                size={42}
                variant="transparent"
                className="glass-action glass-action--square glass-action--active"
                aria-label="Страница избранных кофеен"
              >
                <IconHeartFilled size={18} />
              </ActionIcon>
            </Group>
          </Group>

          {isLoading && (
            <Paper withBorder radius="lg" p="md">
              <Text c="dimmed">Загружаем избранные кофейни...</Text>
            </Paper>
          )}

          {error && (
            <Paper withBorder radius="lg" p="md" style={{ borderColor: "var(--color-status-error)" }}>
              <Text c="red.6" size="sm">
                {error}
              </Text>
            </Paper>
          )}

          {!isLoading && cafes.length === 0 && !error && (
            <Paper withBorder radius="lg" p="md">
              <Text c="dimmed">Пока нет избранных мест. Нажмите сердечко у кофейни.</Text>
            </Paper>
          )}

          {cafes.map((cafe) => {
            const cover = cafe.cover_photo_url ?? cafe.photos?.[0]?.url;
            return (
              <Paper
                key={cafe.id}
                withBorder
                radius="lg"
                p="md"
                style={{
                  background:
                    "linear-gradient(135deg, var(--glass-grad-1), var(--glass-grad-2))",
                  border: "1px solid var(--glass-border)",
                  boxShadow: "var(--shadow)",
                  cursor: "pointer",
                }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedCafe(cafe);
                  setDetailsOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedCafe(cafe);
                  setDetailsOpen(true);
                }}
              >
                <Stack gap="sm">
                  {cover && (
                    <Box
                      style={{
                        height: 144,
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      <img
                        src={cover}
                        alt={`Фото: ${cafe.name}`}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </Box>
                  )}
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                      <Text fw={700} lineClamp={1}>
                        {cafe.name}
                      </Text>
                      <Text c="dimmed" size="sm" lineClamp={2}>
                        {cafe.address}
                      </Text>
                    </Stack>
                    <Group gap={6} wrap="nowrap">
                      <ActionIcon
                        size="md"
                        variant="light"
                        color="red"
                        aria-label="Убрать из избранного"
                        loading={busyCafeId === cafe.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRemove(cafe.id);
                        }}
                      >
                        <IconHeartFilled size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Stack>
              </Paper>
            );
          })}

          {detailsOpen && (
            <Suspense fallback={null}>
              <CafeDetailsScreen
                opened={detailsOpen}
                cafe={selectedCafe}
                onClose={() => setDetailsOpen(false)}
                showDistance={false}
                showRoutes={false}
              />
            </Suspense>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
