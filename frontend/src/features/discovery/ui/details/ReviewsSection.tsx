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
        control={controller.control}
        errors={controller.errors}
        isSubmitting={controller.isSubmitting}
        drinkSelectData={controller.drinkSelectData}
        drinkIdValue={controller.drinkIdValue}
        drinkQueryValue={controller.drinkQueryValue}
        drinksLoading={controller.drinksLoading}
        summaryLength={controller.summaryLength}
        summaryTrimmedLength={controller.summaryTrimmedLength}
        photos={controller.photos}
        uploadingPhotos={controller.uploadingPhotos}
        submitError={controller.submitError}
        submitHint={controller.submitHint}
        fileInputRef={controller.fileInputRef}
        onFormSubmit={controller.onFormSubmit}
        onDrinkSearchChange={controller.onDrinkSearchChange}
        onDrinkChange={controller.onDrinkChange}
        onAppendFiles={controller.onAppendFiles}
        onRemovePhoto={controller.onRemovePhoto}
      />

      <ReviewFeed
        sort={controller.sort}
        onSortChange={controller.setSort}
        isLoading={controller.isLoading}
        isLoadingMore={controller.isLoadingMore}
        loadError={controller.loadError}
        reviews={controller.reviews}
        currentUserId={controller.currentUserId}
        canDeleteReviews={controller.canDeleteReviews}
        onDeleteReview={controller.onDeleteReview}
        hasMore={controller.hasMore}
        onLoadMore={controller.onLoadMore}
      />
    </Stack>
  );
}
