import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../components/AuthGate";
import { updateCafeDescription } from "../../../api/cafes";
import { createJourneyID, reportMetricEvent } from "../../../api/metrics";
import { submitCafeDescription } from "../../../api/submissions";
import {
  getDescriptiveTagOptions,
  getDiscoveryDescriptiveTags,
  getMyDescriptiveTagPreferences,
  updateMyDescriptiveTagPreferences,
} from "../../../api/tags";
import type { Amenity, Cafe, CafePhotoKind } from "../../../entities/cafe/model/types";
import { DEFAULT_AMENITIES, DEFAULT_RADIUS_M } from "../constants";
import useCafeSelection from "./useCafeSelection";
import useCafes from "./useCafes";
import useDiscoveryLocation from "../model/location/useDiscoveryLocation";
import useDiscoveryModals from "../model/modals/useDiscoveryModals";
import useDiscoveryFavoriteActions from "../model/favorites/useDiscoveryFavoriteActions";
import { useLayoutMetrics } from "../layout/LayoutMetricsContext";
import { invalidateCafeCardRatingSnapshot } from "../components/cafe-card/CafeCardFooter";

function normalizeTagList(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of raw) {
    const label = value.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
    if (result.length >= 12) break;
  }
  return result;
}

const LEGACY_MAIN_TAG_PATTERNS = [
  /\bwifi\b/u,
  /\bwi[\s-]?fi\b/u,
  /\bpower\b/u,
  /\blaptop\b/u,
  /\btoilet\b/u,
  /\bquiet\b/u,
  /розетк/u,
  /вайф/u,
  /туалет/u,
  /ноут/u,
  /тихо/u,
];

function isLegacyMainTag(label: string): boolean {
  const value = label.trim().toLowerCase();
  if (!value) return false;
  return LEGACY_MAIN_TAG_PATTERNS.some((pattern) => pattern.test(value));
}

function countCafePhotosByKind(cafe: Cafe | null | undefined, kind: CafePhotoKind): number {
  if (!cafe) return 0;
  const fromList = (cafe.photos ?? []).filter((photo) => photo.kind === kind).length;
  if (kind === "cafe" && fromList <= 0 && typeof cafe.cover_photo_url === "string" && cafe.cover_photo_url.trim()) {
    return 1;
  }
  return fromList;
}

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
  const [topDescriptiveTags, setTopDescriptiveTags] = useState<string[]>([]);
  const [topDescriptiveTagsSource, setTopDescriptiveTagsSource] = useState("city_popular");
  const [isTopTagsLoading, setIsTopTagsLoading] = useState(false);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [tagOptionsQuery, setTagOptionsQuery] = useState("");
  const [isTagOptionsLoading, setIsTagOptionsLoading] = useState(false);
  const [favoriteDescriptiveTags, setFavoriteDescriptiveTags] = useState<string[]>([]);
  const [favoriteDescriptiveTagsDraft, setFavoriteDescriptiveTagsDraft] = useState<string[]>([]);
  const [isFavoriteTagsLoading, setIsFavoriteTagsLoading] = useState(false);
  const [isFavoriteTagsSaving, setIsFavoriteTagsSaving] = useState(false);
  const [favoriteTagsError, setFavoriteTagsError] = useState<string | null>(null);
  const [pendingPhotoProcessingByCafeId, setPendingPhotoProcessingByCafeId] = useState<
    Record<string, { cafe: number; menu: number; updatedAt: number }>
  >({});
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
  const selectedCafePendingPhotos = selectedCafe?.id
    ? pendingPhotoProcessingByCafeId[selectedCafe.id] ?? null
    : null;
  const selectedCafePhotoProcessing = Boolean((selectedCafePendingPhotos?.cafe ?? 0) > 0);
  const selectedMenuPhotoProcessing = Boolean((selectedCafePendingPhotos?.menu ?? 0) > 0);

  useEffect(() => {
    if (Object.keys(pendingPhotoProcessingByCafeId).length === 0) return;
    const now = Date.now();
    const ttlMs = 5 * 60_000;
    setPendingPhotoProcessingByCafeId((prev) => {
      let changed = false;
      const next: Record<string, { cafe: number; menu: number; updatedAt: number }> = {};
      for (const [cafeID, item] of Object.entries(prev)) {
        const cafe = visibleCafes.find((row) => row.id === cafeID) ?? null;
        let nextCafePending = item.cafe;
        let nextMenuPending = item.menu;
        const stale = now - item.updatedAt > ttlMs;
        if (stale) {
          nextCafePending = 0;
          nextMenuPending = 0;
        } else if (cafe) {
          if (countCafePhotosByKind(cafe, "cafe") > 0) {
            nextCafePending = 0;
          }
          if (countCafePhotosByKind(cafe, "menu") > 0) {
            nextMenuPending = 0;
          }
        }
        if (nextCafePending > 0 || nextMenuPending > 0) {
          next[cafeID] = {
            cafe: nextCafePending,
            menu: nextMenuPending,
            updatedAt: item.updatedAt,
          };
        }
        if (nextCafePending !== item.cafe || nextMenuPending !== item.menu || stale) {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pendingPhotoProcessingByCafeId, visibleCafes]);

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

  const refreshTopTags = useCallback(async () => {
    if (location.showFirstChoice) {
      setTopDescriptiveTags([]);
      setTopDescriptiveTagsSource("city_popular");
      return;
    }

    setIsTopTagsLoading(true);
    try {
      const response = await getDiscoveryDescriptiveTags({
        lat,
        lng,
        radius_m: location.effectiveRadiusM,
        limit: 8,
      });
      setTopDescriptiveTags(
        response.tags
          .map((item) => item.label)
          .filter(Boolean)
          .filter((tag) => !isLegacyMainTag(tag)),
      );
      setTopDescriptiveTagsSource(response.source || "city_popular");
    } catch {
      setTopDescriptiveTags([]);
      setTopDescriptiveTagsSource("city_popular");
    } finally {
      setIsTopTagsLoading(false);
    }
  }, [lat, lng, location.effectiveRadiusM, location.showFirstChoice]);

  useEffect(() => {
    void refreshTopTags();
  }, [refreshTopTags, user?.id]);

  useEffect(() => {
    if (!modals.settingsOpen) {
      return;
    }
    if (location.showFirstChoice) {
      setTagOptions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsTagOptionsLoading(true);
      getDescriptiveTagOptions({
        lat,
        lng,
        radius_m: location.effectiveRadiusM,
        q: tagOptionsQuery.trim() || undefined,
        limit: 120,
      })
        .then((response) => {
          if (cancelled) return;
          const merged = normalizeTagList(
            [...response.tags, ...favoriteDescriptiveTagsDraft].filter(
              (tag) => !isLegacyMainTag(tag),
            ),
          );
          setTagOptions(merged);
        })
        .catch(() => {
          if (!cancelled) setTagOptions(normalizeTagList(favoriteDescriptiveTagsDraft));
        })
        .finally(() => {
          if (!cancelled) setIsTagOptionsLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    favoriteDescriptiveTagsDraft,
    lat,
    lng,
    location.effectiveRadiusM,
    location.showFirstChoice,
    modals.settingsOpen,
    tagOptionsQuery,
  ]);

  useEffect(() => {
    if (!user) {
      setFavoriteDescriptiveTags([]);
      setFavoriteDescriptiveTagsDraft([]);
      setFavoriteTagsError(null);
      return;
    }
    if (!modals.settingsOpen) {
      return;
    }

    let cancelled = false;
    setIsFavoriteTagsLoading(true);
    setFavoriteTagsError(null);
    getMyDescriptiveTagPreferences({
      lat,
      lng,
      radius_m: location.effectiveRadiusM,
    })
      .then((response) => {
        if (cancelled) return;
        const normalized = normalizeTagList(response.tags.filter((tag) => !isLegacyMainTag(tag)));
        setFavoriteDescriptiveTags(normalized);
        setFavoriteDescriptiveTagsDraft(normalized);
      })
      .catch(() => {
        if (!cancelled) {
          setFavoriteTagsError("Не удалось загрузить любимые теги.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsFavoriteTagsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, lat, lng, location.effectiveRadiusM, modals.settingsOpen]);

  const handleFavoriteTagsDraftChange = (next: string[]) => {
    setFavoriteDescriptiveTagsDraft(
      normalizeTagList(next.filter((tag) => !isLegacyMainTag(tag))),
    );
    setFavoriteTagsError(null);
  };

  const handleSaveFavoriteTags = async () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    setIsFavoriteTagsSaving(true);
    setFavoriteTagsError(null);
    try {
      const response = await updateMyDescriptiveTagPreferences(
        {
          lat,
          lng,
          radius_m: location.effectiveRadiusM,
        },
        favoriteDescriptiveTagsDraft,
      );
      const normalized = normalizeTagList(response.tags.filter((tag) => !isLegacyMainTag(tag)));
      setFavoriteDescriptiveTags(normalized);
      setFavoriteDescriptiveTagsDraft(normalized);
      await refreshTopTags();
    } catch {
      setFavoriteTagsError("Не удалось сохранить любимые теги.");
    } finally {
      setIsFavoriteTagsSaving(false);
    }
  };

  const isFavoriteTagsDirty =
    favoriteDescriptiveTags.length !== favoriteDescriptiveTagsDraft.length ||
    favoriteDescriptiveTags.some((value, index) => value !== favoriteDescriptiveTagsDraft[index]);

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

  const handlePhotoSubmissionQueued = (payload: {
    cafeId: string;
    kind: CafePhotoKind;
    count: number;
  }) => {
    const targetCafeId = payload.cafeId.trim();
    if (!targetCafeId) return;
    const count = Math.max(1, Math.floor(payload.count || 0));
    setPendingPhotoProcessingByCafeId((prev) => {
      const current = prev[targetCafeId] ?? { cafe: 0, menu: 0, updatedAt: Date.now() };
      return {
        ...prev,
        [targetCafeId]: {
          cafe: payload.kind === "cafe" ? current.cafe + count : current.cafe,
          menu: payload.kind === "menu" ? current.menu + count : current.menu,
          updatedAt: Date.now(),
        },
      };
    });
    setPhotosRefreshToken((prev) => prev + 1);
  };

  const handleReviewSaved = (reviewCafeId: string) => {
    const normalizedCafeId = reviewCafeId.trim();
    if (normalizedCafeId) {
      invalidateCafeCardRatingSnapshot(normalizedCafeId);
    } else {
      invalidateCafeCardRatingSnapshot();
    }
    void cafesQuery.refetch();
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
    selectedCafePhotoProcessing,
    selectedMenuPhotoProcessing,
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
    topDescriptiveTags,
    topDescriptiveTagsSource,
    isTopTagsLoading,
    tagOptions,
    tagOptionsQuery,
    isTagOptionsLoading,
    favoriteDescriptiveTagsDraft,
    isFavoriteTagsLoading,
    isFavoriteTagsSaving,
    favoriteTagsError,
    isFavoriteTagsDirty,
    manualPickMode: location.manualPickMode,
    manualPickedCenter: location.manualPickedCenter,
    manualPinOffsetY: location.manualPinOffsetY,
    manualCenterProbeOffsetY: location.manualCenterProbeOffsetY,
    locationOptions: location.locationOptions,
    selectedLocationId: location.selectedLocationId,
    locationLabel: location.locationLabel,
    proposalCity: location.proposalCity,
    isAuthed: Boolean(user),
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
    handlePhotoSubmissionQueued,
    handleReviewSaved,
    setTagOptionsQuery,
    handleFavoriteTagsDraftChange,
    handleSaveFavoriteTags,
    open2gisRoute,
    openYandexRoute,
    radiusM,
    resetFilters,
  };
}
