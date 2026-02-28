import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "../features/admin/ui";
import { notifications } from "../lib/notifications";
import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import {
  deleteAdminCafeByID,
  getAdminCafeByID,
  searchAdminCafesByName,
  updateAdminCafeByID,
  type AdminCafeDetails,
  type AdminCafeSearchItem,
} from "../api/adminCafes";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";

type AdminCafeEditForm = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  description: string;
  amenities: string;
};

const emptyEditForm: AdminCafeEditForm = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  description: "",
  amenities: "",
};

function toEditForm(cafe: AdminCafeDetails): AdminCafeEditForm {
  return {
    name: cafe.name,
    address: cafe.address,
    latitude: String(cafe.latitude),
    longitude: String(cafe.longitude),
    description: cafe.description ?? "",
    amenities: (cafe.amenities ?? []).join(", "),
  };
}

function parseAmenitiesCSV(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(",")) {
    const normalized = part.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export default function AdminCafesManagePage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status } = useAuth();

  const userRole = (user?.role ?? "").toLowerCase();
  const allowed = userRole === "admin";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<AdminCafeSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCafeID, setSelectedCafeID] = useState<string | null>(null);
  const [selectedCafeName, setSelectedCafeName] = useState("");
  const [editForm, setEditForm] = useState<AdminCafeEditForm>(emptyEditForm);
  const [editLoadState, setEditLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchItems([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      searchAdminCafesByName(query, 20)
        .then((items) => {
          if (!cancelled) {
            setSearchItems(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchItems([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchLoading(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSelectCafe = async (cafeID: string | null) => {
    setSelectedCafeID(cafeID);
    if (!cafeID) {
      setSelectedCafeName("");
      setEditForm(emptyEditForm);
      setEditLoadState("idle");
      return;
    }

    const selected = searchItems.find((item) => item.id === cafeID);
    setSelectedCafeName(selected?.name ?? "");
    setEditLoadState("loading");
    try {
      const cafe = await getAdminCafeByID(cafeID);
      setEditForm(toEditForm(cafe));
      setEditLoadState("idle");
    } catch (error: unknown) {
      setEditLoadState("error");
      notifications.show({
        color: "red",
        title: "Ошибка загрузки",
        message: extractApiErrorMessage(error, "Не удалось загрузить кофейню для редактирования."),
      });
    }
  };

  const handleSave = async () => {
    if (!selectedCafeID) {
      return;
    }

    const name = editForm.name.trim();
    const address = editForm.address.trim();
    const latitude = Number(editForm.latitude.replace(",", "."));
    const longitude = Number(editForm.longitude.replace(",", "."));
    const description = editForm.description.trim();
    const amenities = parseAmenitiesCSV(editForm.amenities);

    if (!name || !address) {
      notifications.show({
        color: "red",
        title: "Проверьте форму",
        message: "Название и адрес обязательны.",
      });
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      notifications.show({
        color: "red",
        title: "Проверьте координаты",
        message: "latitude должен быть в диапазоне от -90 до 90.",
      });
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      notifications.show({
        color: "red",
        title: "Проверьте координаты",
        message: "longitude должен быть в диапазоне от -180 до 180.",
      });
      return;
    }

    setSaveLoading(true);
    try {
      const updated = await updateAdminCafeByID(selectedCafeID, {
        name,
        address,
        latitude,
        longitude,
        description,
        amenities,
      });
      setEditForm(toEditForm(updated));
      setSelectedCafeName(updated.name);
      setSearchItems((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { id: updated.id, name: updated.name, address: updated.address } : item,
        ),
      );
      notifications.show({
        color: "green",
        title: "Кофейня обновлена",
        message: "Изменения сохранены.",
      });
    } catch (error: unknown) {
      notifications.show({
        color: "red",
        title: "Ошибка сохранения",
        message: extractApiErrorMessage(error, "Не удалось сохранить изменения кофейни."),
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCafeID) {
      return;
    }
    const label = selectedCafeName.trim() || "эту кофейню";
    const approved = window.confirm(`Удалить ${label}? Это действие необратимо.`);
    if (!approved) {
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteAdminCafeByID(selectedCafeID);
      notifications.show({
        color: "green",
        title: "Кофейня удалена",
        message: "Запись удалена из базы.",
      });
      setSearchItems((prev) => prev.filter((item) => item.id !== selectedCafeID));
      setSelectedCafeID(null);
      setSelectedCafeName("");
      setEditForm(emptyEditForm);
      setEditLoadState("idle");
    } catch (error: unknown) {
      notifications.show({
        color: "red",
        title: "Ошибка удаления",
        message: extractApiErrorMessage(error, "Не удалось удалить кофейню."),
      });
    } finally {
      setDeleteLoading(false);
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
              <Title order={3}>Управление кофейнями</Title>
            </Group>
            <Button variant="secondary" onClick={() => void navigate("/admin/cafes/import")}>
              Импорт JSON
            </Button>
          </Group>

          <Alert icon={<IconInfoCircle size={16} />} color="blue">
            Поиск по названию, редактирование всех полей и удаление кофейни.
          </Alert>

          <Select
            label="Найти кофейню по названию"
            placeholder="Введите минимум 2 символа"
            searchable
            clearable
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            value={selectedCafeID}
            onChange={(value) => {
              void handleSelectCafe(value);
            }}
            rightSection={searchLoading ? <Loader size={16} /> : null}
            data={searchItems.map((item) => ({
              value: item.id,
              label: `${item.name} — ${item.address || "без адреса"}`,
            }))}
            nothingFoundMessage={searchQuery.trim().length < 2 ? "Введите минимум 2 символа" : "Ничего не найдено"}
          />

          {selectedCafeID && (
            <Stack gap="xs">
              {editLoadState === "loading" ? (
                <Text size="sm" c="dimmed">
                  Загружаем данные кофейни...
                </Text>
              ) : editLoadState === "error" ? (
                <Alert color="red" title="Не удалось загрузить кофейню">
                  Повторите выбор кофейни из списка.
                </Alert>
              ) : (
                <>
                  <Group>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <TextInput
                        label="Название"
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, name: event.currentTarget.value }))
                        }
                      />
                    </Box>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <TextInput
                        label="Адрес"
                        value={editForm.address}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, address: event.currentTarget.value }))
                        }
                      />
                    </Box>
                  </Group>
                  <Group>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <TextInput
                        label="Latitude"
                        value={editForm.latitude}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, latitude: event.currentTarget.value }))
                        }
                      />
                    </Box>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <TextInput
                        label="Longitude"
                        value={editForm.longitude}
                        onChange={(event) =>
                          setEditForm((prev) => ({ ...prev, longitude: event.currentTarget.value }))
                        }
                      />
                    </Box>
                  </Group>
                  <Textarea
                    label="Описание"
                    minRows={4}
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, description: event.currentTarget.value }))
                    }
                  />
                  <TextInput
                    label="Amenities (через запятую)"
                    placeholder="wifi, power, quiet, toilet, laptop"
                    value={editForm.amenities}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, amenities: event.currentTarget.value }))
                    }
                  />
                  <Group justify="space-between">
                    <Button loading={saveLoading} onClick={() => void handleSave()}>
                      Сохранить изменения
                    </Button>
                    <Button variant="destructive" loading={deleteLoading} onClick={() => void handleDelete()}>
                      Удалить кофейню
                    </Button>
                  </Group>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
