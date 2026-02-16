import { Box } from "@mantine/core";

import Map from "../components/Map";
import { DISCOVERY_UI_TEXT } from "../features/discovery/constants";
import BottomSheet from "../features/discovery/components/BottomSheet";
import CafeCard from "../features/discovery/components/CafeCard";
import CafeList from "../features/discovery/components/CafeList";
import EmptyStateCard from "../features/discovery/components/EmptyStateCard";
import FiltersBar from "../features/discovery/components/FiltersBar";
import FloatingControls from "../features/discovery/components/FloatingControls";
import CafePhotoAdminModal from "../features/discovery/components/CafePhotoAdminModal";
import CafePhotoSubmissionModal from "../features/discovery/components/CafePhotoSubmissionModal";
import useDiscoveryPageController from "../features/discovery/hooks/useDiscoveryPageController";
import CafeDetailsScreen from "../features/discovery/ui/details/CafeDetailsScreen";
import ManualPickOverlay from "../features/discovery/ui/map/ManualPickOverlay";
import CafeProposalModal from "../features/discovery/ui/modals/CafeProposalModal";
import SettingsDrawer from "../features/discovery/ui/settings/SettingsDrawer";
import DiscoveryLocationChoiceHeader from "../features/discovery/ui/sheet/DiscoveryLocationChoiceHeader";
import DiscoveryManualPickHeader from "../features/discovery/ui/sheet/DiscoveryManualPickHeader";

export default function DiscoveryScreen() {
  const {
    sheetRef,
    sheetHeight,
    sheetState,
    cafesQuery,
    visibleCafes,
    userCenter,
    focusLngLat,
    selectedCafeId,
    selectedCafe,
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
    selectedAmenities,
    favoritesOnly,
    favoriteBusyCafeId,
    manualPickMode,
    manualPickedCenter,
    manualPinOffsetY,
    manualCenterProbeOffsetY,
    locationOptions,
    selectedLocationId,
    locationLabel,
    proposalCity,
    isPhotoAdmin,
    setSettingsOpen,
    setDetailsOpen,
    setPhotoAdminOpen,
    setPhotoSubmitOpen,
    setCafeProposalOpen,
    setSelectedAmenities,
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
    handleStartCafeDescriptionEdit,
    handleSaveCafeDescription,
    handleOpenCafeProposal,
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
        selectedAmenities={selectedAmenities}
        onChangeAmenities={setSelectedAmenities}
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
        onSuggestCafe={handleOpenCafeProposal}
      />

      <CafeDetailsScreen
        opened={detailsOpen}
        cafe={selectedCafe ?? null}
        onClose={() => setDetailsOpen(false)}
        showDistance={!isCityOnlyMode}
        showRoutes={!isCityOnlyMode}
        onOpen2gis={selectedCafe ? () => open2gisRoute(selectedCafe) : undefined}
        onOpenYandex={selectedCafe ? () => openYandexRoute(selectedCafe) : undefined}
        onStartDescriptionEdit={handleStartCafeDescriptionEdit}
        onSaveDescription={handleSaveCafeDescription}
        isFavorite={Boolean(selectedCafe?.is_favorite)}
        onToggleFavorite={handleToggleFavorite}
        favoriteLoading={Boolean(selectedCafe?.id) && selectedCafe?.id === favoriteBusyCafeId}
        onManagePhotos={handleOpenPhotoAdmin}
        canManageDirectly={isPhotoAdmin}
      />

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

      <CafePhotoSubmissionModal
        opened={photoSubmitOpen}
        cafeId={selectedCafe?.id ?? null}
        cafeName={selectedCafe?.name ?? ""}
        kind={photoSubmitKind}
        onClose={() => setPhotoSubmitOpen(false)}
      />

      <CafeProposalModal
        opened={cafeProposalOpen}
        mapCenter={userCenter}
        city={proposalCity || undefined}
        onClose={() => setCafeProposalOpen(false)}
      />
    </Box>
  );
}
