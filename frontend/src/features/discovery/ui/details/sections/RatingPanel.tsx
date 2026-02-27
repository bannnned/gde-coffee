import { Badge } from "../../../../../components/ui";
import type {
  CafeRatingBestReview,
  CafeRatingDiagnostics,
} from "../../../../../api/reviews";
import AdminDiagnosticsPanel from "./AdminDiagnosticsPanel";
import classes from "./RatingPanel.module.css";

type RatingPanelProps = {
  ratingLabel: string;
  ratingIsPreliminary?: boolean;
  ratingReviews: number;
  verifiedSharePercent: number;
  showVerifiedSharePercent?: boolean;
  onOpenReviews?: () => void;
  ratingLoading: boolean;
  ratingError: string | null;
  bestReview: CafeRatingBestReview | null;
  canViewAdminDiagnostics: boolean;
  ratingDiagnostics: CafeRatingDiagnostics | null;
  ratingDiagnosticsLoading: boolean;
  ratingDiagnosticsError: string | null;
  ratingDiagnosticsExpanded: boolean;
  onToggleDiagnosticsExpanded: () => void;
  diagnosticsTrust: number;
  diagnosticsBase: number;
  diagnosticsTopReviews: CafeRatingDiagnostics["reviews"];
  aiSummaryTriggerLoading: boolean;
  onTriggerAISummary: () => void;
};

export default function RatingPanel({
  ratingLabel,
  ratingIsPreliminary = false,
  ratingReviews,
  verifiedSharePercent,
  showVerifiedSharePercent = false,
  onOpenReviews,
  ratingLoading,
  ratingError,
  bestReview,
  canViewAdminDiagnostics,
  ratingDiagnostics,
  ratingDiagnosticsLoading,
  ratingDiagnosticsError,
  ratingDiagnosticsExpanded,
  onToggleDiagnosticsExpanded,
  diagnosticsTrust,
  diagnosticsBase,
  diagnosticsTopReviews,
  aiSummaryTriggerLoading,
  onTriggerAISummary,
}: RatingPanelProps) {
  return (
    <>
      <div className={classes.statsRow}>
        <Badge className={classes.statChip}>Рейтинг: {ratingLabel}</Badge>
        <button
          type="button"
          className={`${classes.statChipButton} ${onOpenReviews ? "ui-focus-ring" : ""}`}
          onClick={onOpenReviews}
          disabled={!onOpenReviews}
          aria-label="Перейти к отзывам"
          title={onOpenReviews ? "Открыть раздел отзывов" : undefined}
        >
          Отзывы: {ratingReviews}
        </button>
        {showVerifiedSharePercent && (
          <Badge className={classes.statChip}>Визиты: {verifiedSharePercent}%</Badge>
        )}
      </div>
      {ratingLoading ? <p className={classes.metaText}>Обновляем рейтинг...</p> : null}
      {ratingError ? <p className={classes.metaText}>{ratingError}</p> : null}
      {ratingIsPreliminary && ratingReviews > 0 ? (
        <p className={classes.metaText}>
          Предварительный рейтинг: до 5 отзывов показываем среднюю оценку по звёздам.
        </p>
      ) : null}
      {canViewAdminDiagnostics ? (
        <AdminDiagnosticsPanel
          diagnostics={ratingDiagnostics}
          loading={ratingDiagnosticsLoading}
          error={ratingDiagnosticsError}
          expanded={ratingDiagnosticsExpanded}
          onToggleExpanded={onToggleDiagnosticsExpanded}
          trustValue={diagnosticsTrust}
          baseValue={diagnosticsBase}
          topReviews={diagnosticsTopReviews}
          onTriggerAISummary={onTriggerAISummary}
          aiSummaryTriggerLoading={aiSummaryTriggerLoading}
        />
      ) : null}
      {bestReview && bestReview.id ? (
        <div className={classes.bestReviewCard}>
          <div className={classes.bestReviewStack}>
            <div className={classes.bestReviewHeader}>
              <p className={classes.bestReviewTitle}>Лучший отзыв</p>
              <Badge className={classes.metaChip}>
                Полезность: {bestReview.helpful_score.toFixed(1)}
              </Badge>
            </div>
            <p className={classes.bestReviewAuthor}>{bestReview.author_name}</p>
            <p className={classes.bestReviewText}>{bestReview.summary}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
