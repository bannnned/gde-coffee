import { ActionIcon, Collapse, Group, Stack, Text } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

import { ReviewComposerCard } from "./reviews/ReviewComposerCard";
import { ReviewFeed } from "./reviews/ReviewFeed";
import { useReviewsSectionController } from "./reviews/useReviewsSectionController";

type ReviewsSectionProps = {
  cafeId: string;
  opened: boolean;
};

export default function ReviewsSection({ cafeId, opened }: ReviewsSectionProps) {
  const controller = useReviewsSectionController({ cafeId, opened });
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={600} size="sm">
          Отзывы
        </Text>
        <ActionIcon
          variant={composerOpen ? "filled" : "light"}
          radius="xl"
          size="lg"
          aria-label={composerOpen ? "Скрыть форму отзыва" : "Добавить отзыв"}
          onClick={() => setComposerOpen((prev) => !prev)}
        >
          <IconPlus size={18} />
        </ActionIcon>
      </Group>

      <Collapse in={composerOpen}>
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
          activeCheckIn={controller.activeCheckIn}
          checkInStarting={controller.checkInStarting}
          verifyVisitPending={controller.verifyVisitPending}
          submitError={controller.submitError}
          submitHint={controller.submitHint}
          fileInputRef={controller.fileInputRef}
          onFormSubmit={controller.onFormSubmit}
          onAppendFiles={controller.onAppendFiles}
          onRemovePhoto={controller.onRemovePhoto}
          onStartCheckIn={controller.onStartCheckIn}
          onVerifyCurrentVisit={controller.onVerifyCurrentVisit}
        />
      </Collapse>

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
