import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "../../../../components/ui";
import { ReviewComposerCard } from "./reviews/ReviewComposerCard";
import { ReviewFeed } from "./reviews/ReviewFeed";
import { useReviewsSectionController } from "./reviews/useReviewsSectionController";

type ReviewsSectionProps = {
  cafeId: string;
  opened: boolean;
  journeyID?: string;
  onReviewSaved?: (cafeId: string) => void;
};

export default function ReviewsSection({
  cafeId,
  opened,
  journeyID = "",
  onReviewSaved,
}: ReviewsSectionProps) {
  const controller = useReviewsSectionController({ cafeId, opened, journeyID, onReviewSaved });
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    if (controller.submitSuccessVersion <= 0) return;
    setComposerOpen(false);
  }, [controller.submitSuccessVersion]);

  const handleComposerToggle = () => {
    setComposerOpen((prev) => {
      const next = !prev;
      if (next && controller.ownReview) {
        controller.hydrateComposerFromOwnReview();
      }
      return next;
    });
  };

  const hasOwnReview = Boolean(controller.ownReview);

  return (
    <div className="relative flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {composerOpen ? (
          <motion.div
            key="reviews-composer"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-1">
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
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
        isAdmin={controller.isAdmin}
        onDeleteReview={controller.onDeleteReview}
        hasMore={controller.hasMore}
        onLoadMore={controller.onLoadMore}
        onReviewRead={controller.onReviewRead}
      />

      <div
        style={{
          position: "sticky",
          right: 0,
          bottom: 14,
          width: "100%",
          marginTop: -6,
          display: "flex",
          justifyContent: "flex-end",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        <Button
          type="button"
          variant={composerOpen ? "default" : "secondary"}
          size="icon"
          aria-label={
            composerOpen
              ? "Скрыть форму отзыва"
              : hasOwnReview
                ? "Редактировать отзыв"
                : "Добавить отзыв"
          }
          onClick={handleComposerToggle}
          className="h-12 w-12 rounded-full"
          style={{
            pointerEvents: "auto",
            boxShadow: "0 10px 24px color-mix(in srgb, var(--color-brand-accent-soft) 55%, transparent)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(10px) saturate(140%)",
            WebkitBackdropFilter: "blur(10px) saturate(140%)",
          }}
        >
          {hasOwnReview ? <IconPencil size={20} /> : <IconPlus size={20} />}
        </Button>
      </div>
    </div>
  );
}
