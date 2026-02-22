import { Box } from "@mantine/core";
import { lazy, Suspense } from "react";

import Map from "../components/Map";
import { DISCOVERY_UI_TEXT } from "../features/discovery/constants";
import BottomSheet from "../features/discovery/components/BottomSheet";
import CafeCard from "../features/discovery/components/CafeCard";
import CafeList from "../features/discovery/components/CafeList";
import EmptyStateCard from "../features/discovery/components/EmptyStateCard";
import FiltersBar from "../features/discovery/components/FiltersBar";
import FloatingControls from "../features/discovery/components/FloatingControls";
import useDiscoveryPageController from "../features/discovery/hooks/useDiscoveryPageController";
import ManualPickOverlay from "../features/discovery/ui/map/ManualPickOverlay";
import SettingsDrawer from "../features/discovery/ui/settings/SettingsDrawer";
import DiscoveryLocationChoiceHeader from "../features/discovery/ui/sheet/DiscoveryLocationChoiceHeader";
import DiscoveryManualPickHeader from "../features/discovery/ui/sheet/DiscoveryManualPickHeader";

const CafeDetailsScreen = lazy(() => import("../features/discovery/ui/details/CafeDetailsScreen"));
const CafePhotoAdminModal = lazy(() => import("../features/discovery/components/CafePhotoAdminModal"));
const CafePhotoSubmissionModal = lazy(
  () => import("../features/discovery/components/CafePhotoSubmissionModal"),
);
const CafeProposalModal = lazy(() => import("../features/discovery/ui/modals/CafeProposalModal"));

export default function DiscoveryScreen() {
  const {
    sheetRef,
    sheetHeight,
    sheetState,
    filtersBarHeight,
    cafesQuery,
    visibleCafes,
    userCenter,
    focusLngLat,
    selectedCafeId,
    selectedCafe,
    selectedCafeJourneyID,
    photosRefreshToken,
    selectedCafePhotoProcessing,
    selectedMenuPhotoProcessing,
    itemRefs,
    showFetchingBadge,
    showFirstChoice,
    showEmptyState,
    needsLocationChoice,
    isCityOnlyMode,
    emptyState,
    isLocating,
    settingsOpen,
    detailsOpen,
    photoAdminOpen,
    photoAdminKind,
    photoSubmitOpen,
    photoSubmitKind,
    cafeProposalOpen,
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
    manualPickMode,
    manualPickedCenter,
    manualPinOffsetY,
    manualCenterProbeOffsetY,
    locationOptions,
    selectedLocationId,
    locationLabel,
    proposalCity,
    isAuthed,
    isPrivilegedUser,
    isPhotoAdmin,
    setSettingsOpen,
    setDetailsOpen,
    setPhotoAdminOpen,
    setPhotoSubmitOpen,
    setCafeProposalOpen,
    setRadiusM,
    selectCafe,
    handleManualCenterChange,
    handleCancelManualPick,
    handleConfirmManualPick,
    handleLocateMe,
    handleSelectLocation,
    handleStartManualPick,
    handleToggleFavoritesFilter,
    handleToggleFavorite,
    handleOpenPhotoAdmin,
    handlePhotosChanged,
    handlePhotoSubmissionQueued,
    handleStartCafeDescriptionEdit,
    handleSaveCafeDescription,
    handleOpenCafeProposal,
    handleReviewSaved,
    setTagOptionsQuery,
    handleFavoriteTagsDraftChange,
    handleSaveFavoriteTags,
    open2gisRoute,
    openYandexRoute,
    radiusM,
    resetFilters,
  } = useDiscoveryPageController();

  return (
    <Box
      pos="relative"
      h="100dvh"
      w="100%"
      data-sheet-state={sheetState}
      style={{ ["--sheet-height" as string]: `${sheetHeight}px` }}
    >
      <Box pos="absolute" inset={0}>
        <Map
          center={userCenter}
          zoom={13}
          cafes={visibleCafes}
          filtersBarHeight={filtersBarHeight}
          userLocation={isCityOnlyMode || manualPickMode ? null : userCenter}
          selectedCafeId={selectedCafeId}
          focusLngLat={manualPickMode ? null : focusLngLat}
          onCafeSelect={manualPickMode ? undefined : selectCafe}
          disableCafeClick={manualPickMode}
          paddingEnabled
          centerProbeOffsetY={manualPickMode ? manualCenterProbeOffsetY : 0}
          onCenterChange={manualPickMode ? handleManualCenterChange : undefined}
        />
      </Box>

      {manualPickMode && (
        <ManualPickOverlay
          pinOffsetY={manualPinOffsetY}
          canConfirm={Boolean(manualPickedCenter)}
          onCancel={handleCancelManualPick}
          onConfirm={handleConfirmManualPick}
        />
      )}

      <FiltersBar
        topTags={topDescriptiveTags}
        topTagsSource={topDescriptiveTagsSource}
        topTagsLoading={isTopTagsLoading}
        favoritesOnly={favoritesOnly}
        onToggleFavorites={handleToggleFavoritesFilter}
        canToggleFavorites
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
        errorText={DISCOVERY_UI_TEXT.errorLoad}
        isListEmpty={manualPickMode || showFirstChoice || visibleCafes.length === 0}
        lockedState={manualPickMode ? "peek" : null}
        disableMidState={false}
        hideHeaderContentInPeek={false}
        header={
          showFirstChoice ? (
            <DiscoveryLocationChoiceHeader
              locationOptions={locationOptions}
              selectedLocationId={selectedLocationId}
              onLocateMe={handleLocateMe}
              onStartManualPick={handleStartManualPick}
              onSelectLocation={handleSelectLocation}
            />
          ) : manualPickMode ? (
            <DiscoveryManualPickHeader />
          ) : selectedCafe ? (
            <CafeCard
              cafe={selectedCafe}
              onOpen2gis={open2gisRoute}
              onOpenYandex={openYandexRoute}
              onAddFirstPhoto={() => handleOpenPhotoAdmin("cafe")}
              onOpenDetails={() => setDetailsOpen(true)}
              isPhotoProcessing={selectedCafePhotoProcessing}
              showDistance={!isCityOnlyMode}
              showRoutes={!isCityOnlyMode}
            />
          ) : showEmptyState ? (
            <EmptyStateCard
              emptyState={emptyState}
              isError={cafesQuery.isError}
              isLocating={isLocating}
              locationOptions={locationOptions}
              onResetFilters={resetFilters}
              onRetry={() => {
                void cafesQuery.refetch();
              }}
              onLocate={handleLocateMe}
              onSelectLocation={handleSelectLocation}
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
        locationLabel={locationLabel}
        locationOptions={locationOptions}
        selectedLocationId={selectedLocationId}
        onSelectLocation={handleSelectLocation}
        onOpenMapPicker={handleStartManualPick}
        highlightLocationBlock={needsLocationChoice}
        onSuggestCafe={handleOpenCafeProposal}
        popularTags={topDescriptiveTags}
        topTags={favoriteDescriptiveTagsDraft}
        topTagsOptions={tagOptions}
        topTagsQuery={tagOptionsQuery}
        topTagsOptionsLoading={isTagOptionsLoading}
        topTagsLoading={isFavoriteTagsLoading}
        topTagsSaving={isFavoriteTagsSaving}
        topTagsError={favoriteTagsError}
        topTagsDirty={isFavoriteTagsDirty}
        isAuthed={isAuthed}
        onTopTagsChange={handleFavoriteTagsDraftChange}
        onTopTagsQueryChange={setTagOptionsQuery}
        onSaveTopTags={handleSaveFavoriteTags}
      />

      {detailsOpen && (
        <Suspense fallback={null}>
          <CafeDetailsScreen
            opened={detailsOpen}
            cafe={selectedCafe ?? null}
            journeyID={selectedCafeJourneyID}
            photosRefreshToken={photosRefreshToken}
            onReviewSaved={handleReviewSaved}
            onClose={() => setDetailsOpen(false)}
            isCafePhotoProcessing={selectedCafePhotoProcessing}
            isMenuPhotoProcessing={selectedMenuPhotoProcessing}
            showDistance={!isCityOnlyMode}
            showRoutes={!isCityOnlyMode}
            onOpen2gis={selectedCafe ? () => open2gisRoute(selectedCafe) : undefined}
            onOpenYandex={selectedCafe ? () => openYandexRoute(selectedCafe) : undefined}
            onStartDescriptionEdit={handleStartCafeDescriptionEdit}
            onSaveDescription={handleSaveCafeDescription}
            isFavorite={Boolean(selectedCafe?.is_favorite)}
            onToggleFavorite={() => {
              void handleToggleFavorite();
            }}
            favoriteLoading={Boolean(selectedCafe?.id) && selectedCafe?.id === favoriteBusyCafeId}
            onManagePhotos={handleOpenPhotoAdmin}
            canManageDirectly={isPhotoAdmin}
            canViewAdminDiagnostics={isPrivilegedUser}
          />
        </Suspense>
      )}

      {photoAdminOpen && (
        <Suspense fallback={null}>
          <CafePhotoAdminModal
            opened={photoAdminOpen}
            cafeId={selectedCafe?.id ?? null}
            cafeName={selectedCafe?.name ?? ""}
            kind={photoAdminKind}
            initialPhotos={
              (selectedCafe?.photos ?? []).filter((photo) => photo.kind === photoAdminKind)
            }
            onClose={() => setPhotoAdminOpen(false)}
            onPhotosChanged={handlePhotosChanged}
          />
        </Suspense>
      )}

      {photoSubmitOpen && (
        <Suspense fallback={null}>
          <CafePhotoSubmissionModal
            opened={photoSubmitOpen}
            cafeId={selectedCafe?.id ?? null}
            cafeName={selectedCafe?.name ?? ""}
            kind={photoSubmitKind}
            existingPhotosCount={
              selectedCafe
                ? (photoSubmitKind === "menu"
                    ? (selectedCafe?.photos ?? []).filter((photo) => photo.kind === "menu").length
                    : Math.max(
                        (selectedCafe?.photos ?? []).filter((photo) => photo.kind === "cafe").length,
                        selectedCafe?.cover_photo_url ? 1 : 0,
                      ))
                : 0
            }
            onSubmitted={handlePhotoSubmissionQueued}
            onClose={() => setPhotoSubmitOpen(false)}
          />
        </Suspense>
      )}

      {cafeProposalOpen && (
        <Suspense fallback={null}>
          <CafeProposalModal
            opened={cafeProposalOpen}
            mapCenter={userCenter}
            city={proposalCity || undefined}
            onClose={() => setCafeProposalOpen(false)}
          />
        </Suspense>
      )}
    </Box>
  );
}
