import { Stack } from "@mantine/core";

import { ReviewComposerCard } from "./reviews/ReviewComposerCard";
import { ReviewFeed } from "./reviews/ReviewFeed";
import { useReviewsSectionController } from "./reviews/useReviewsSectionController";

type ReviewsSectionProps = {
  cafeId: string;
  opened: boolean;
};

export default function ReviewsSection({ cafeId, opened }: ReviewsSectionProps) {
  const controller = useReviewsSectionController({ cafeId, opened });

  return (
    <Stack gap="sm">
      <ReviewComposerCard
        ownReview={controller.ownReview}
        ownReviewQualityInsight={controller.ownReviewQualityInsight}
        draftQualitySuggestions={controller.draftQualitySuggestions}
        control={controller.control}
        errors={controller.errors}
        isSubmitting={controller.isSubmitting}
        positionsInput={controller.positionsInput}
        positionInputData={controller.positionInputData}
        drinksLoading={controller.drinksLoading}
        onPositionsInputSearchChange={controller.setDrinkSearchQuery}
        summaryLength={controller.summaryLength}
        summaryTrimmedLength={controller.summaryTrimmedLength}
        photos={controller.photos}
        uploadingPhotos={controller.uploadingPhotos}
        submitError={controller.submitError}
        submitHint={controller.submitHint}
        fileInputRef={controller.fileInputRef}
        onFormSubmit={controller.onFormSubmit}
        onAppendFiles={controller.onAppendFiles}
        onRemovePhoto={controller.onRemovePhoto}
      />

      <ReviewFeed
        sort={controller.sort}
        onSortChange={controller.setSort}
        positionFilter={controller.positionFilter}
        onPositionFilterChange={controller.setPositionFilter}
        positionOptions={controller.positionOptions}
        isLoading={controller.isLoading}
        isLoadingMore={controller.isLoadingMore}
        loadError={controller.loadError}
        reviews={controller.reviews}
        currentUserId={controller.currentUserId}
        helpfulPendingReviewID={controller.helpfulPendingReviewID}
        onMarkHelpful={controller.onMarkHelpful}
        canDeleteReviews={controller.canDeleteReviews}
        onDeleteReview={controller.onDeleteReview}
        hasMore={controller.hasMore}
        onLoadMore={controller.onLoadMore}
      />
    </Stack>
  );
}
