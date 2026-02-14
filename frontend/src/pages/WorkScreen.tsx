import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { IconMapPinFilled } from "@tabler/icons-react";

import { useAuth } from "../components/AuthGate";
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
import CafePhotoAdminModal from "../features/work/components/CafePhotoAdminModal";
import useCafeSelection from "../features/work/hooks/useCafeSelection";
import useCafes from "../features/work/hooks/useCafes";
import useGeolocation from "../features/work/hooks/useGeolocation";
import { useLayoutMetrics } from "../features/work/layout/LayoutMetricsContext";

const LOCATION_STORAGE_KEY = "coffeeQuest.location";

const LOCATION_OPTIONS = [
  { id: "spb", label: "Санкт-Петербург", center: SPB_CENTER },
  { id: "moscow", label: "Москва", center: MOSCOW_CENTER },
] as const;

const CITY_RADIUS_M_BY_ID: Record<(typeof LOCATION_OPTIONS)[number]["id"], number> = {
  spb: 30000,
  moscow: 35000,
};
const MANUAL_PIN_NUDGE_PX = 2;

type LocationId = (typeof LOCATION_OPTIONS)[number]["id"];

type LocationChoice =
  | { type: "geolocation" }
  | { type: "city"; id: LocationId }
  | { type: "manual"; center: [number, number] };

export default function WorkScreen() {
  const { user, openAuthModal } = useAuth();
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [photoAdminOpen, setPhotoAdminOpen] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>(
    DEFAULT_AMENITIES,
  );
  const { sheetHeight, sheetState } = useLayoutMetrics();

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [locationChoice, setLocationChoice] = useState<LocationChoice | null>(
    () => {
      if (typeof window === "undefined") return { type: "city", id: "spb" };
      try {
        const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
        if (!raw) return { type: "city", id: "spb" };
        const parsed = JSON.parse(raw) as {
          type?: string;
          id?: unknown;
          center?: unknown;
        };
        if (parsed?.type === "geolocation") {
          return { type: "geolocation" };
        }
        if (
          parsed?.type === "city" &&
          typeof parsed.id === "string" &&
          LOCATION_OPTIONS.some((option) => option.id === parsed.id)
        ) {
          return { type: "city", id: parsed.id as LocationId };
        }
        if (
          (parsed?.type === "manual" || parsed?.type === "map") &&
          Array.isArray(parsed.center) &&
          parsed.center.length === 2
        ) {
          const lng = Number(parsed.center[0]);
          const lat = Number(parsed.center[1]);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            return { type: "city", id: "spb" };
          }
          return {
            type: "manual",
            center: [lng, lat],
          };
        }
      } catch {
        return { type: "city", id: "spb" };
      }
      return { type: "city", id: "spb" };
    },
  );
  const [manualPickMode, setManualPickMode] = useState(false);
  const [manualPickedCenter, setManualPickedCenter] = useState<[number, number] | null>(
    null,
  );
  const [manualStartCenter, setManualStartCenter] = useState<[number, number] | null>(
    null,
  );

  const initialCenter = useMemo(() => {
    if (locationChoice?.type === "city") {
      const option = LOCATION_OPTIONS.find((item) => item.id === locationChoice.id);
      return option?.center ?? SPB_CENTER;
    }
    if (locationChoice?.type === "manual") {
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
  } = useGeolocation(initialCenter, {
    autoLocate: locationChoice?.type === "geolocation",
  });

  const nearestCityId = useMemo(() => {
    const [lngValue, latValue] = userCenter;
    const metersPerLat = 111_320;
    const metersPerLng = Math.max(
      1,
      Math.cos((latValue * Math.PI) / 180) * metersPerLat,
    );

    return LOCATION_OPTIONS.reduce<(typeof LOCATION_OPTIONS)[number]["id"]>(
      (closest, option, index) => {
        if (index === 0) return option.id;
        const current = LOCATION_OPTIONS.find((item) => item.id === closest)!;
        const currentDx = (lngValue - current.center[0]) * metersPerLng;
        const currentDy = (latValue - current.center[1]) * metersPerLat;
        const nextDx = (lngValue - option.center[0]) * metersPerLng;
        const nextDy = (latValue - option.center[1]) * metersPerLat;
        const currentDistSq = currentDx * currentDx + currentDy * currentDy;
        const nextDistSq = nextDx * nextDx + nextDy * nextDy;
        return nextDistSq < currentDistSq ? option.id : closest;
      },
      LOCATION_OPTIONS[0].id,
    );
  }, [userCenter]);

  const effectiveRadiusM = useMemo(() => {
    if (locationChoice?.type === "city") {
      return CITY_RADIUS_M_BY_ID[locationChoice.id];
    }
    if (radiusM === 0) {
      return CITY_RADIUS_M_BY_ID[nearestCityId];
    }
    return radiusM;
  }, [locationChoice, nearestCityId, radiusM]);

  const [lng, lat] = userCenter;
  const { cafes, cafesQuery, showFetchingBadge } = useCafes({
    lat,
    lng,
    radiusM: effectiveRadiusM,
    amenities: selectedAmenities,
    enabled: locationChoice !== null,
  });
  const visibleCafes = locationChoice ? cafes : [];
  const { selectedCafeId, selectedCafe, selectCafe, itemRefs } =
    useCafeSelection({ cafes: visibleCafes, onFocusLngLat: setFocusLngLat });

  const showFirstChoice = locationChoice === null && !manualPickMode;
  const needsLocationChoice = locationChoice === null;
  const emptyState = cafesQuery.isError
    ? "error"
    : visibleCafes.length === 0 &&
        locationChoice?.type === "geolocation" &&
        geoStatus !== "ok"
      ? "no-geo"
      : "no-results";
  const showEmptyState =
    !showFirstChoice &&
    !manualPickMode &&
    !cafesQuery.isLoading &&
    visibleCafes.length === 0;
  const isCityOnlyMode = locationChoice?.type === "city";
  const manualPinOffsetY = MANUAL_PIN_NUDGE_PX;

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
    if (locationChoice?.type === "manual") {
      return "Выбранная точка";
    }
    if (locationChoice?.type === "geolocation") {
      if (geoStatus === "loading") return "Определяем...";
      if (geoStatus === "ok") return "Мое местоположение";
      return "Геолокация";
    }
    return "Не выбрано";
  }, [geoStatus, locationChoice]);

  useEffect(() => {
    if (!locationChoice) return;
    if (locationChoice.type === "geolocation") return;
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

  useEffect(() => {
    if (!selectedCafe) setDetailsOpen(false);
  }, [selectedCafe]);

  useEffect(() => {
    if (!selectedCafe) setPhotoAdminOpen(false);
  }, [selectedCafe]);

  const handleSelectLocation = (id: string) => {
    const option = LOCATION_OPTIONS.find((item) => item.id === id);
    if (!option) return;
    setManualPickMode(false);
    setRadiusM(0);
    setLocationChoice({ type: "city", id: option.id });
  };

  const handleStartManualPick = () => {
    setManualStartCenter(userCenter);
    setManualPickedCenter(userCenter);
    setManualPickMode(true);
    setDetailsOpen(false);
    setSettingsOpen(false);
    setFocusLngLat(userCenter);
  };

  const handleCancelManualPick = () => {
    setManualPickMode(false);
    setManualPickedCenter(null);
    if (manualStartCenter) {
      setFocusLngLat(manualStartCenter);
    }
    setManualStartCenter(null);
  };

  const handleConfirmManualPick = () => {
    if (!manualPickedCenter) return;
    setLocationChoice({ type: "manual", center: manualPickedCenter });
    setManualPickMode(false);
    setManualStartCenter(null);
  };

  const handleLocateMe = () => {
    if (manualPickMode) {
      locateMe(true);
      return;
    }
    setManualPickMode(false);
    setLocationChoice({ type: "geolocation" });
    locateMe(true);
  };

  useEffect(() => {
    if (!manualPickMode) return;
    setManualPickedCenter(userCenter);
  }, [manualPickMode, userCenter]);

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

  const handleOpenPhotoAdmin = () => {
    if (!selectedCafe) return;
    if (!user) {
      openAuthModal("login");
      return;
    }
    setPhotoAdminOpen(true);
  };

  const handlePhotosChanged = () => {
    void cafesQuery.refetch();
  };

  return (
    <Box
      pos="relative"
      h="100vh"
      w="100%"
      data-sheet-state={sheetState}
      style={{ ["--sheet-height" as string]: `${sheetHeight}px` }}
    >
      <Box pos="absolute" inset={0}>
        <Map
          center={userCenter}
          zoom={13}
          cafes={visibleCafes}
          userLocation={isCityOnlyMode || manualPickMode ? null : userCenter}
          selectedCafeId={selectedCafeId}
          focusLngLat={manualPickMode ? null : focusLngLat}
          onCafeSelect={manualPickMode ? undefined : selectCafe}
          disableCafeClick={manualPickMode}
          paddingEnabled
          centerProbeOffsetY={manualPickMode ? manualPinOffsetY : 0}
          onCenterChange={
            manualPickMode ? (lngLat) => setManualPickedCenter(lngLat) : undefined
          }
        />
      </Box>

      {manualPickMode && (
        <>
          <Box
            style={{
              position: "absolute",
              left: "50%",
              top: `calc(50% + ${manualPinOffsetY}px)`,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            <IconMapPinFilled size={40} color="var(--color-map-cafe-marker)" stroke={1.5} />
          </Box>
          <Group
            justify="center"
            gap="xs"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "calc(var(--sheet-height, 240px) + 20px)",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <Button
              variant="default"
              style={{ pointerEvents: "auto" }}
              onClick={handleCancelManualPick}
            >
              Отмена
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
              style={{ pointerEvents: "auto" }}
              onClick={handleConfirmManualPick}
              disabled={!manualPickedCenter}
            >
              Выбрать
            </Button>
          </Group>
        </>
      )}

      <FiltersBar
        selectedAmenities={selectedAmenities}
        onChangeAmenities={setSelectedAmenities}
        onOpenSettings={() => setSettingsOpen(true)}
        showFetchingBadge={showFetchingBadge}
        highlightSettingsButton={needsLocationChoice}
      />

      <FloatingControls
        onLocate={handleLocateMe}
        isLocating={isLocating}
        highlight={needsLocationChoice}
      />

      <BottomSheet
        sheetRef={sheetRef}
        isError={cafesQuery.isError && visibleCafes.length === 0}
        errorText={WORK_UI_TEXT.errorLoad}
        isListEmpty={showFirstChoice || visibleCafes.length === 0}
        header={
          showFirstChoice ? (
            <Paper radius="xl" p="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  Выберите, как определить точку поиска
                </Text>
                <Button
                  variant="gradient"
                  gradient={{ from: "emerald.6", to: "lime.5", deg: 135 }}
                  onClick={handleLocateMe}
                >
                  Включить геолокацию
                </Button>
                <Button variant="light" onClick={handleStartManualPick}>
                  Выбрать вручную на карте
                </Button>
                <Select
                  data={locationOptions.map((option) => ({
                    value: option.id,
                    label: option.label,
                  }))}
                  value={selectedLocationId || null}
                  placeholder="Или выбрать город"
                  searchable
                  nothingFoundMessage="Ничего не найдено"
                  onChange={(value) => {
                    if (!value) return;
                    handleSelectLocation(value);
                  }}
                />
              </Stack>
            </Paper>
          ) : selectedCafe ? (
            <CafeCard
              cafe={selectedCafe}
              onOpen2gis={open2gisRoute}
              onOpenYandex={openYandexRoute}
              onOpenDetails={() => setDetailsOpen(true)}
              showDistance={!isCityOnlyMode}
              showRoutes={!isCityOnlyMode}
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
          cafes={visibleCafes}
          isLoading={cafesQuery.isLoading}
          selectedCafeId={selectedCafeId}
          onSelectCafe={selectCafe}
          itemRefs={itemRefs}
          showDistance={!isCityOnlyMode}
        />
      </BottomSheet>

      <SettingsDrawer
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        radiusM={radiusM}
        onRadiusChange={setRadiusM}
        isRadiusLocked={isCityOnlyMode}
        selectedAmenities={selectedAmenities}
        onChangeAmenities={setSelectedAmenities}
        locationLabel={locationLabel}
        locationOptions={locationOptions}
        selectedLocationId={selectedLocationId}
        onSelectLocation={handleSelectLocation}
        onOpenMapPicker={handleStartManualPick}
        highlightLocationBlock={needsLocationChoice}
      />

      <CafeDetailsScreen
        opened={detailsOpen}
        cafe={selectedCafe ?? null}
        onClose={() => setDetailsOpen(false)}
        showDistance={!isCityOnlyMode}
        onManagePhotos={handleOpenPhotoAdmin}
      />

      <CafePhotoAdminModal
        opened={photoAdminOpen}
        cafeId={selectedCafe?.id ?? null}
        cafeName={selectedCafe?.name ?? ""}
        initialPhotos={selectedCafe?.photos ?? []}
        onClose={() => setPhotoAdminOpen(false)}
        onPhotosChanged={handlePhotosChanged}
      />
    </Box>
  );
}
