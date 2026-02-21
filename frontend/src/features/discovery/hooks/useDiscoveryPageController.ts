import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../../components/AuthGate";
import { updateCafeDescription } from "../../../api/cafes";
import { createJourneyID, reportMetricEvent } from "../../../api/metrics";
import { submitCafeDescription } from "../../../api/submissions";
import type { Amenity, Cafe } from "../../../entities/cafe/model/types";
import { DEFAULT_AMENITIES, DEFAULT_RADIUS_M } from "../constants";
import useCafeSelection from "./useCafeSelection";
import useCafes from "./useCafes";
import useDiscoveryLocation from "../model/location/useDiscoveryLocation";
import useDiscoveryModals from "../model/modals/useDiscoveryModals";
import useDiscoveryFavoriteActions from "../model/favorites/useDiscoveryFavoriteActions";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";

export default function useDiscoveryPageController() {
  const { user, openAuthModal } = useAuth();
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [selectedAmenities, setSelectedAmenities] = useState<Amenity[]>(
    DEFAULT_AMENITIES,
  );
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteBusyCafeId, setFavoriteBusyCafeId] = useState<string | null>(null);
  const [selectedCafeJourneyID, setSelectedCafeJourneyID] = useState("");
  const [photosRefreshToken, setPhotosRefreshToken] = useState(0);
  const { sheetHeight, sheetState, filtersBarHeight } = useLayoutMetrics();

  const userRole = (user?.role ?? "").toLowerCase();
  const isPrivilegedUser = userRole === "admin" || userRole === "moderator";
  const isPhotoAdmin = userRole === "admin";

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const journeyByCafeRef = useRef<Record<string, string>>({});
  const cardOpenedJourneyRef = useRef<Set<string>>(new Set());

  const location = useDiscoveryLocation({
    radiusM,
    setRadiusM,
    sheetHeight,
  });

  const [lng, lat] = location.userCenter;
  const { cafes, cafesQuery, showFetchingBadge } = useCafes({
    lat,
    lng,
    radiusM: location.effectiveRadiusM,
    amenities: selectedAmenities,
    favoritesOnly,
    enabled: location.locationChoice !== null,
  });
  const visibleCafes = location.locationChoice ? cafes : [];
  const { selectedCafeId, selectedCafe, selectCafe, itemRefs } =
    useCafeSelection({ cafes: visibleCafes, onFocusLngLat: location.setFocusLngLat });

  useEffect(() => {
    if (!selectedCafeId) {
      setSelectedCafeJourneyID("");
      return;
    }

    let journeyID = journeyByCafeRef.current[selectedCafeId];
    if (!journeyID) {
      journeyID = createJourneyID(selectedCafeId);
      journeyByCafeRef.current[selectedCafeId] = journeyID;
    }
    setSelectedCafeJourneyID(journeyID);
    if (!cardOpenedJourneyRef.current.has(journeyID)) {
      cardOpenedJourneyRef.current.add(journeyID);
      reportMetricEvent({
        event_type: "cafe_card_open",
        journey_id: journeyID,
        cafe_id: selectedCafeId,
        meta: { source: "discovery" },
      });
    }
  }, [selectedCafeId]);

  const modals = useDiscoveryModals(selectedCafe);
  const { handleToggleFavoritesFilter, handleToggleFavorite } = useDiscoveryFavoriteActions({
    user,
    openAuthModal,
    selectedCafe,
    favoritesOnly,
    setFavoritesOnly,
    favoriteBusyCafeId,
    setFavoriteBusyCafeId,
  });

  const emptyState = cafesQuery.isError
    ? "error"
    : visibleCafes.length === 0 &&
        location.locationChoice?.type === "geolocation" &&
        location.geoStatus !== "ok"
      ? "no-geo"
      : "no-results";
  const showEmptyState =
    !location.showFirstChoice &&
    !location.manualPickMode &&
    !cafesQuery.isLoading &&
    visibleCafes.length === 0;

  function resolveJourneyID(cafeID: string): string {
    const safeCafeID = cafeID.trim();
    if (!safeCafeID) return "";
    let journeyID = journeyByCafeRef.current[safeCafeID];
    if (!journeyID) {
      journeyID = createJourneyID(safeCafeID);
      journeyByCafeRef.current[safeCafeID] = journeyID;
    }
    return journeyID;
  }

  function resetFilters() {
    setRadiusM(0);
    setSelectedAmenities([]);
    setFavoritesOnly(false);
  }

  const handleStartManualPick = () => {
    modals.closePanelsForManualPick();
    location.startManualPick();
  };

  function open2gisRoute(cafe: Cafe) {
    const journeyID = resolveJourneyID(cafe.id);
    if (journeyID) {
      reportMetricEvent({
        event_type: "route_click",
        journey_id: journeyID,
        cafe_id: cafe.id,
        provider: "2gis",
        meta: { source: "discovery" },
      });
    }
    const from = `${location.userCenter[0]},${location.userCenter[1]}`;
    const to = `${cafe.longitude},${cafe.latitude}`;
    window.open(
      `https://2gis.ru/directions/points/${from}|${to}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openYandexRoute(cafe: Cafe) {
    const journeyID = resolveJourneyID(cafe.id);
    if (journeyID) {
      reportMetricEvent({
        event_type: "route_click",
        journey_id: journeyID,
        cafe_id: cafe.id,
        provider: "yandex",
        meta: { source: "discovery" },
      });
    }
    const from = `${location.userCenter[1]}%2C${location.userCenter[0]}`;
    const to = `${cafe.latitude}%2C${cafe.longitude}`;
    window.open(
      `https://yandex.ru/maps/?rtext=${from}~${to}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function selectCafeWithJourney(id: string) {
    const nextID = id.trim();
    if (!nextID) return;
    if (!journeyByCafeRef.current[nextID] || selectedCafeId !== nextID) {
      journeyByCafeRef.current[nextID] = createJourneyID(nextID);
    }
    selectCafe(nextID);
  }

  const handleOpenPhotoAdmin = (kind: "cafe" | "menu") => {
    if (!selectedCafe) return;
    if (!user) {
      modals.setDetailsOpen(false);
      openAuthModal("login");
      return;
    }
    if (isPhotoAdmin) {
      modals.setPhotoAdminKind(kind);
      modals.setPhotoAdminOpen(true);
      return;
    }
    modals.setPhotoSubmitKind(kind);
    modals.setPhotoSubmitOpen(true);
  };

  const handlePhotosChanged = () => {
    setPhotosRefreshToken((prev) => prev + 1);
    void cafesQuery.refetch();
  };

  const handleSaveCafeDescription = async (description: string) => {
    if (!selectedCafe) {
      throw new Error("Кофейня не выбрана.");
    }
    if (!user) {
      modals.setDetailsOpen(false);
      openAuthModal("login");
      throw new Error("Войдите в аккаунт, чтобы добавить описание.");
    }

    if (isPrivilegedUser) {
      const saved = await updateCafeDescription(selectedCafe.id, description);
      void cafesQuery.refetch();
      return {
        applied: true,
        description: saved,
        message: "Описание сохранено.",
      };
    }

    await submitCafeDescription(selectedCafe.id, description);
    return {
      applied: false,
      message: "Заявка на описание отправлена на модерацию.",
    };
  };

  const handleStartCafeDescriptionEdit = () => {
    if (user) return true;
    modals.setDetailsOpen(false);
    openAuthModal("login");
    return false;
  };

  const handleOpenCafeProposal = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    modals.setCafeProposalOpen(true);
    modals.setSettingsOpen(false);
  };

  return {
    sheetRef,
    sheetHeight,
    sheetState,
    filtersBarHeight,
    cafesQuery,
    visibleCafes,
    userCenter: location.userCenter,
    focusLngLat: location.focusLngLat,
    selectedCafeId,
    selectedCafe,
    selectedCafeJourneyID,
    photosRefreshToken,
    itemRefs,
    showFetchingBadge,
    showFirstChoice: location.showFirstChoice,
    showEmptyState,
    needsLocationChoice: location.needsLocationChoice,
    isCityOnlyMode: location.isCityOnlyMode,
    emptyState,
    isLocating: location.isLocating,
    settingsOpen: modals.settingsOpen,
    detailsOpen: modals.detailsOpen,
    photoAdminOpen: modals.photoAdminOpen,
    photoAdminKind: modals.photoAdminKind,
    photoSubmitOpen: modals.photoSubmitOpen,
    photoSubmitKind: modals.photoSubmitKind,
    cafeProposalOpen: modals.cafeProposalOpen,
    selectedAmenities,
    favoritesOnly,
    favoriteBusyCafeId,
    manualPickMode: location.manualPickMode,
    manualPickedCenter: location.manualPickedCenter,
    manualPinOffsetY: location.manualPinOffsetY,
    manualCenterProbeOffsetY: location.manualCenterProbeOffsetY,
    locationOptions: location.locationOptions,
    selectedLocationId: location.selectedLocationId,
    locationLabel: location.locationLabel,
    proposalCity: location.proposalCity,
    isPrivilegedUser,
    isPhotoAdmin,
    setSettingsOpen: modals.setSettingsOpen,
    setDetailsOpen: modals.setDetailsOpen,
    setPhotoAdminOpen: modals.setPhotoAdminOpen,
    setPhotoSubmitOpen: modals.setPhotoSubmitOpen,
    setCafeProposalOpen: modals.setCafeProposalOpen,
    setSelectedAmenities,
    setRadiusM,
    selectCafe: selectCafeWithJourney,
    handleManualCenterChange: location.handleManualCenterChange,
    handleCancelManualPick: location.handleCancelManualPick,
    handleConfirmManualPick: location.handleConfirmManualPick,
    handleLocateMe: location.handleLocateMe,
    handleSelectLocation: location.handleSelectLocation,
    handleStartManualPick,
    handleToggleFavoritesFilter,
    handleToggleFavorite: () => handleToggleFavorite(() => cafesQuery.refetch()),
    handleOpenPhotoAdmin,
    handlePhotosChanged,
    handleStartCafeDescriptionEdit,
    handleSaveCafeDescription,
    handleOpenCafeProposal,
    open2gisRoute,
    openYandexRoute,
    radiusM,
    resetFilters,
  };
}
