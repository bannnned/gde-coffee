import { useEffect, useRef, useState } from "react";
import { Box } from "@mantine/core";

import Map from "../components/Map";
import type { Amenity, Cafe } from "../types";
import {
  DEFAULT_AMENITIES,
  DEFAULT_RADIUS_M,
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

export default function WorkScreen() {
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>(
    DEFAULT_AMENITIES,
  );
  const { sheetHeight, sheetState } = useLayoutMetrics();

  const sheetRef = useRef<HTMLDivElement | null>(null);

  function resetFilters() {
    setRadiusM(0);
    setSelectedAmenities([]);
  }

  const {
    userCenter,
    focusLngLat,
    setFocusLngLat,
    locateMe,
    geoStatus,
    isLocating,
  } = useGeolocation(SPB_CENTER);

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
        onLocate={() => locateMe(true)}
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
              onLocate={() => locateMe(true)}
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
      />

      <CafeDetailsScreen
        opened={detailsOpen}
        cafe={selectedCafe ?? null}
        onClose={() => setDetailsOpen(false)}
      />
    </Box>
  );
}
