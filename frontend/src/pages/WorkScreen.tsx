import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Group, Modal, Stack, Text } from "@mantine/core";

import Map from "../components/Map";
import type { Amenity, Cafe } from "../types";
import {
  DEFAULT_AMENITIES,
  DEFAULT_RADIUS_M,
  MOSCOW_CENTER,
  SPB_CENTER,
  WORK_UI_TEXT,
} from "../features/work/constants";
import BottomSheet from "../features/work/components/BottomSheet";
import CafeCard from "../features/work/components/CafeCard";
import CafeList from "../features/work/components/CafeList";
import CafeDetailsScreen from "../features/work/components/CafeDetailsScreen";
import EmptyStateCard from "../features/work/components/EmptyStateCard";
import FiltersBar from "../features/work/components/FiltersBar";
import FloatingControls from "../features/work/components/FloatingControls";
import SettingsDrawer from "../features/work/components/SettingsDrawer";
import useCafeSelection from "../features/work/hooks/useCafeSelection";
import useCafes from "../features/work/hooks/useCafes";
import useGeolocation from "../features/work/hooks/useGeolocation";
import { useLayoutMetrics } from "../features/work/layout/LayoutMetricsContext";

const LOCATION_STORAGE_KEY = "coffeeQuest.location";

const LOCATION_OPTIONS = [
  { id: "spb", label: "Санкт-Петербург", center: SPB_CENTER },
  { id: "moscow", label: "Москва", center: MOSCOW_CENTER },
] as const;

type LocationId = (typeof LOCATION_OPTIONS)[number]["id"];

type LocationChoice =
  | { type: "city"; id: LocationId }
  | { type: "map"; center: [number, number] };

export default function WorkScreen() {
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>(
    DEFAULT_AMENITIES,
  );
  const { sheetHeight, sheetState } = useLayoutMetrics();

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as LocationChoice;
        if (
          parsed?.type === "city" &&
          LOCATION_OPTIONS.some((option) => option.id === parsed.id)
        ) {
          return parsed;
        }
        if (
          parsed?.type === "map" &&
          Array.isArray(parsed.center) &&
          parsed.center.length === 2
        ) {
          return {
            type: "map",
            center: [Number(parsed.center[0]), Number(parsed.center[1])],
          };
        }
      } catch {
        return null;
      }
      return null;
    },
  );
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<[number, number] | null>(
    null,
  );

  const initialCenter = useMemo(() => {
    if (locationChoice?.type === "city") {
      const option = LOCATION_OPTIONS.find((item) => item.id === locationChoice.id);
      return option?.center ?? SPB_CENTER;
    }
    if (locationChoice?.type === "map") {
      return locationChoice.center;
    }
    return SPB_CENTER;
  }, [locationChoice]);

  function resetFilters() {
    setRadiusM(0);
    setSelectedAmenities([]);
  }

  const {
    userCenter,
    focusLngLat,
    setFocusLngLat,
    locateMe,
    setManualCenter,
    geoStatus,
    isLocating,
  } = useGeolocation(initialCenter, { autoLocate: locationChoice === null });

  const [lng, lat] = userCenter;
  const { cafes, cafesQuery, showFetchingBadge } = useCafes({
    lat,
    lng,
    radiusM,
    amenities: selectedAmenities,
  });
  const { selectedCafeId, selectedCafe, selectCafe, itemRefs } =
    useCafeSelection({ cafes, onFocusLngLat: setFocusLngLat });

  const emptyState = cafesQuery.isError
    ? "error"
    : cafes.length === 0 && geoStatus !== "ok"
      ? "no-geo"
      : "no-results";
  const showEmptyState = !cafesQuery.isLoading && cafes.length === 0;

  const locationOptions = useMemo(
    () => LOCATION_OPTIONS.map(({ id, label }) => ({ id, label })),
    [],
  );
  const selectedLocationId =
    locationChoice?.type === "city" ? locationChoice.id : "";

  const locationLabel = useMemo(() => {
    if (locationChoice?.type === "city") {
      return (
        LOCATION_OPTIONS.find((option) => option.id === locationChoice.id)
          ?.label ?? "Выбранный город"
      );
    }
    if (locationChoice?.type === "map") {
      return "Выбранная точка";
    }
    if (geoStatus === "loading") return "Определяем...";
    if (geoStatus === "ok") return "Мое местоположение";
    return "Геолокация";
  }, [geoStatus, locationChoice]);

  useEffect(() => {
    if (!locationChoice) return;
    const nextCenter =
      locationChoice.type === "city"
        ? LOCATION_OPTIONS.find((option) => option.id === locationChoice.id)
            ?.center ?? SPB_CENTER
        : locationChoice.center;
    setManualCenter(nextCenter);
    setFocusLngLat(nextCenter);
  }, [locationChoice, setManualCenter, setFocusLngLat]);

  useEffect(() => {
    try {
      if (!locationChoice) {
        window.localStorage.removeItem(LOCATION_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify(locationChoice),
      );
    } catch {
      // ignore storage failures
    }
  }, [locationChoice]);

  const handleSelectLocation = (id: string) => {
    const option = LOCATION_OPTIONS.find((item) => item.id === id);
    if (!option) return;
    setLocationChoice({ type: "city", id: option.id });
  };

  const handleOpenMapPicker = () => {
    setPickedCenter(userCenter);
    setMapPickerOpen(true);
  };

  const handleConfirmMapPicker = () => {
    if (!pickedCenter) return;
    setLocationChoice({ type: "map", center: pickedCenter });
    setMapPickerOpen(false);
  };

  const handleLocateMe = () => {
    setLocationChoice(null);
    locateMe(true);
  };

  function open2gisRoute(cafe: Cafe) {
    const from = `${userCenter[0]},${userCenter[1]}`; // lon,lat
    const to = `${cafe.longitude},${cafe.latitude}`; // lon,lat
    window.open(
      `https://2gis.ru/directions/points/${from}|${to}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openYandexRoute(cafe: Cafe) {
    const from = `${userCenter[1]}%2C${userCenter[0]}`; // lat,lon
    const to = `${cafe.latitude}%2C${cafe.longitude}`; // lat,lon
    window.open(
      `https://yandex.ru/maps/?rtext=${from}~${to}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  useEffect(() => {
    if (!selectedCafe) setDetailsOpen(false);
  }, [selectedCafe]);

  return (
    <Box
      pos="relative"
      h="100vh"
      w="100%"
      data-sheet-state={sheetState}
      style={{ ["--sheet-height" as string]: `${sheetHeight}px` }}
    >
      {/* MAP full screen */}
      <Box pos="absolute" inset={0}>
        <Map
          center={userCenter}
          zoom={13}
          cafes={cafes}
          userLocation={userCenter}
          selectedCafeId={selectedCafeId}
          focusLngLat={focusLngLat}
          onCafeSelect={selectCafe}
        />
      </Box>

      <FiltersBar
        selectedAmenities={selectedAmenities}
        onChangeAmenities={setSelectedAmenities}
        onOpenSettings={() => setSettingsOpen(true)}
        showFetchingBadge={showFetchingBadge}
      />

      <FloatingControls
        onLocate={handleLocateMe}
        isLocating={isLocating}
      />

      <BottomSheet
        sheetRef={sheetRef}
        isError={cafesQuery.isError && cafes.length === 0}
        errorText={WORK_UI_TEXT.errorLoad}
        isListEmpty={cafes.length === 0}
        header={
          selectedCafe ? (
            <CafeCard
              cafe={selectedCafe}
              onOpen2gis={open2gisRoute}
              onOpenYandex={openYandexRoute}
              onOpenDetails={() => setDetailsOpen(true)}
            />
          ) : showEmptyState ? (
            <EmptyStateCard
              emptyState={emptyState}
              isError={cafesQuery.isError}
              isLocating={isLocating}
              onResetFilters={resetFilters}
              onRetry={() => cafesQuery.refetch()}
              onLocate={handleLocateMe}
            />
          ) : null
        }
      >
        <CafeList
          cafes={cafes}
          isLoading={cafesQuery.isLoading}
          selectedCafeId={selectedCafeId}
          onSelectCafe={selectCafe}
          itemRefs={itemRefs}
        />
      </BottomSheet>

      <SettingsDrawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        radiusM={radiusM}
        onRadiusChange={setRadiusM}
        selectedAmenities={selectedAmenities}
        onChangeAmenities={setSelectedAmenities}
        locationLabel={locationLabel}
        locationOptions={locationOptions}
        selectedLocationId={selectedLocationId}
        onSelectLocation={handleSelectLocation}
        onOpenMapPicker={handleOpenMapPicker}
      />

      <Modal
        opened={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        fullScreen
        title="Выбор места"
        styles={{
          content: { background: "var(--bg)" },
          header: {
            borderBottom: "1px solid rgba(255, 255, 240, 0.12)",
            background: "transparent",
          },
          body: { paddingBottom: 24 },
        }}
      >
        <Stack h="100%" gap="md">
          <Box
            style={{
              flex: 1,
              minHeight: 280,
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <Map
              center={pickedCenter ?? userCenter}
              zoom={13}
              cafes={[]}
              userLocation={pickedCenter ?? userCenter}
              onMapClick={(lngLat) => setPickedCenter(lngLat)}
              disableCafeClick
              paddingEnabled={false}
              focusLngLat={pickedCenter ?? userCenter}
            />
          </Box>
          <Text size="sm" c="dimmed">
            Нажмите на карту, чтобы выбрать точку. Мы будем искать рядом с ней.
          </Text>
          <Group justify="space-between">
            <Button variant="subtle" onClick={() => setMapPickerOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
              onClick={handleConfirmMapPicker}
              disabled={!pickedCenter}
            >
              Выбрать
            </Button>
          </Group>
        </Stack>
      </Modal>

      <CafeDetailsScreen
        opened={detailsOpen}
        cafe={selectedCafe ?? null}
        onClose={() => setDetailsOpen(false)}
      />
    </Box>
  );
}
