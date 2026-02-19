import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import {
  createAdminDrink,
  ignoreUnknownDrinkFormat,
  listAdminDrinks,
  listUnknownDrinkFormats,
  mapUnknownDrinkFormat,
  updateAdminDrink,
  type AdminDrink,
  type UnknownDrinkFormat,
} from "../api/adminDrinks";
import { useAuth } from "../components/AuthGate";
import useAllowBodyScroll from "../hooks/useAllowBodyScroll";
import { extractApiErrorMessage } from "../utils/apiError";
import {
  normalizeDrinkText,
  normalizeDrinkToken,
  parseAliases,
  toEditorState,
} from "../features/admin-drinks/model/normalizers";
import type {
  DrinkEditorState,
  UnknownStatusOption,
} from "../features/admin-drinks/model/types";
import AdminDrinksFiltersCard from "../features/admin-drinks/ui/AdminDrinksFiltersCard";
import AdminDrinksCreateCard from "../features/admin-drinks/ui/AdminDrinksCreateCard";
import AdminDrinksCatalogCard from "../features/admin-drinks/ui/AdminDrinksCatalogCard";
import AdminDrinksEditCard from "../features/admin-drinks/ui/AdminDrinksEditCard";
import AdminDrinksUnknownCard from "../features/admin-drinks/ui/AdminDrinksUnknownCard";

const emptyCreateState: DrinkEditorState = {
  id: "",
  name: "",
  aliases: "",
  description: "",
  category: "other",
  popularityRank: "100",
  isActive: true,
};

function notifyError(err: unknown, fallback: string) {
  notifications.show({
    color: "red",
    title: "Ошибка",
    message: extractApiErrorMessage(err, fallback),
  });
}

export default function AdminDrinksPage() {
  useAllowBodyScroll();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const role = (user?.role ?? "").toLowerCase();
  const allowed = role === "admin" || role === "moderator";

  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [drinks, setDrinks] = useState<AdminDrink[]>([]);
  const [selectedDrinkID, setSelectedDrinkID] = useState("");
  const [drinksLoading, setDrinksLoading] = useState(false);

  const [drinkEditor, setDrinkEditor] = useState<DrinkEditorState | null>(null);
  const [createState, setCreateState] = useState<DrinkEditorState>(emptyCreateState);
  const [createLoading, setCreateLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [unknownStatus, setUnknownStatus] = useState<UnknownStatusOption>("new");
  const [unknown, setUnknown] = useState<UnknownDrinkFormat[]>([]);
  const [unknownLoading, setUnknownLoading] = useState(false);
  const [unknownMapTarget, setUnknownMapTarget] = useState<Record<number, string>>({});

  const loadDrinks = useCallback(async () => {
    if (!allowed) return;
    setDrinksLoading(true);
    try {
      const list = await listAdminDrinks({
        q: query,
        includeInactive,
        limit: 200,
      });
      setDrinks(list);
      if (!selectedDrinkID && list.length > 0) {
        setSelectedDrinkID(list[0].id);
      } else if (selectedDrinkID && !list.some((item) => item.id === selectedDrinkID)) {
        setSelectedDrinkID(list[0]?.id ?? "");
      }
    } catch (err: unknown) {
      notifyError(err, "Не удалось загрузить справочник напитков.");
    } finally {
      setDrinksLoading(false);
    }
  }, [allowed, includeInactive, query, selectedDrinkID]);

  const loadUnknown = useCallback(async () => {
    if (!allowed) return;
    setUnknownLoading(true);
    try {
      const list = await listUnknownDrinkFormats({
        status: unknownStatus,
        limit: 200,
        offset: 0,
      });
      setUnknown(list);
    } catch (err: unknown) {
      notifyError(err, "Не удалось загрузить неизвестные форматы.");
    } finally {
      setUnknownLoading(false);
    }
  }, [allowed, unknownStatus]);

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(() => {
      void loadDrinks();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [allowed, loadDrinks]);

  useEffect(() => {
    void loadUnknown();
  }, [loadUnknown]);

  const selectedDrink = useMemo(
    () => drinks.find((item) => item.id === selectedDrinkID) ?? null,
    [drinks, selectedDrinkID],
  );

  useEffect(() => {
    if (!selectedDrink) {
      setDrinkEditor(null);
      return;
    }
    setDrinkEditor(toEditorState(selectedDrink));
  }, [selectedDrink]);

  const drinkOptions = useMemo(
    () => drinks.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` })),
    [drinks],
  );

  const handleCreate = async () => {
    const name = normalizeDrinkText(createState.name);
    if (!name) {
      notifications.show({ color: "red", title: "Ошибка", message: "Название напитка обязательно." });
      return;
    }
    const popularityRank = Number(createState.popularityRank);
    if (!Number.isFinite(popularityRank) || popularityRank < 0) {
      notifications.show({ color: "red", title: "Ошибка", message: "Ранг должен быть >= 0." });
      return;
    }

    setCreateLoading(true);
    try {
      const created = await createAdminDrink({
        id: normalizeDrinkToken(createState.id),
        name,
        aliases: parseAliases(createState.aliases),
        description: createState.description.trim(),
        category: normalizeDrinkToken(createState.category) || "other",
        popularity_rank: popularityRank,
        is_active: createState.isActive,
      });
      notifications.show({ color: "green", title: "Готово", message: "Напиток добавлен." });
      setCreateState(emptyCreateState);
      await loadDrinks();
      setSelectedDrinkID(created.id);
    } catch (err: unknown) {
      notifyError(err, "Не удалось добавить напиток.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSave = async () => {
    if (!drinkEditor || !selectedDrinkID) return;
    const name = normalizeDrinkText(drinkEditor.name);
    if (!name) {
      notifications.show({ color: "red", title: "Ошибка", message: "Название напитка обязательно." });
      return;
    }
    const popularityRank = Number(drinkEditor.popularityRank);
    if (!Number.isFinite(popularityRank) || popularityRank < 0) {
      notifications.show({ color: "red", title: "Ошибка", message: "Ранг должен быть >= 0." });
      return;
    }

    setSaveLoading(true);
    try {
      await updateAdminDrink(selectedDrinkID, {
        name,
        aliases: parseAliases(drinkEditor.aliases),
        description: drinkEditor.description.trim(),
        category: normalizeDrinkToken(drinkEditor.category) || "other",
        popularity_rank: popularityRank,
        is_active: drinkEditor.isActive,
      });
      notifications.show({ color: "green", title: "Готово", message: "Напиток сохранен." });
      await loadDrinks();
    } catch (err: unknown) {
      notifyError(err, "Не удалось сохранить изменения.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleToggleActive = async (drink: AdminDrink, nextActive: boolean) => {
    try {
      await updateAdminDrink(drink.id, { is_active: nextActive });
      await loadDrinks();
    } catch (err: unknown) {
      notifyError(err, "Не удалось изменить статус напитка.");
    }
  };

  const handleMapUnknown = async (item: UnknownDrinkFormat) => {
    const drinkID = (unknownMapTarget[item.id] ?? "").trim();
    if (!drinkID) {
      notifications.show({ color: "red", title: "Ошибка", message: "Выберите напиток для маппинга." });
      return;
    }
    try {
      await mapUnknownDrinkFormat(item.id, { drink_id: drinkID, add_alias: true });
      notifications.show({ color: "green", title: "Готово", message: "Неизвестный формат привязан к напитку." });
      await Promise.all([loadUnknown(), loadDrinks()]);
    } catch (err: unknown) {
      notifyError(err, "Не удалось привязать формат.");
    }
  };

  const handleIgnoreUnknown = async (item: UnknownDrinkFormat) => {
    try {
      await ignoreUnknownDrinkFormat(item.id);
      notifications.show({ color: "green", title: "Готово", message: "Формат помечен как ignored." });
      await loadUnknown();
    } catch (err: unknown) {
      notifyError(err, "Не удалось обновить статус формата.");
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
          <Text c="dimmed">Эта страница доступна только модераторам и администраторам.</Text>
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
              <Title order={3}>Справочник напитков</Title>
            </Group>
            <Button variant="light" onClick={() => void Promise.all([loadDrinks(), loadUnknown()])}>
              Обновить
            </Button>
          </Group>

          <AdminDrinksFiltersCard
            query={query}
            includeInactive={includeInactive}
            onQueryChange={setQuery}
            onIncludeInactiveChange={setIncludeInactive}
          />

          <AdminDrinksCreateCard
            state={createState}
            loading={createLoading}
            onChange={(patch) => setCreateState((prev) => ({ ...prev, ...patch }))}
            onSubmit={() => void handleCreate()}
          />

          <AdminDrinksCatalogCard
            drinks={drinks}
            loading={drinksLoading}
            selectedDrinkID={selectedDrinkID}
            onSelectDrink={setSelectedDrinkID}
            onToggleActive={(drink, nextActive) => void handleToggleActive(drink, nextActive)}
          />

          <AdminDrinksEditCard
            drinkID={selectedDrinkID}
            state={drinkEditor}
            loading={saveLoading}
            onChange={(patch) =>
              setDrinkEditor((prev) => {
                if (!prev) return prev;
                return { ...prev, ...patch };
              })
            }
            onSave={() => void handleSave()}
          />

          <AdminDrinksUnknownCard
            status={unknownStatus}
            unknown={unknown}
            loading={unknownLoading}
            drinkOptions={drinkOptions}
            unknownMapTarget={unknownMapTarget}
            onStatusChange={setUnknownStatus}
            onMapTargetChange={(id, drinkID) =>
              setUnknownMapTarget((prev) => ({
                ...prev,
                [id]: drinkID,
              }))
            }
            onMapUnknown={(item) => void handleMapUnknown(item)}
            onIgnoreUnknown={(item) => void handleIgnoreUnknown(item)}
          />
        </Stack>
      </Container>
    </Box>
  );
}
