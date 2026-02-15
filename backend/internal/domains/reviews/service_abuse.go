package reviews

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

const (
	sqlSelectReviewAuthorForAbuse = `select user_id::text
   from reviews
  where id = $1::uuid and status = 'published'`

	sqlInsertAbuseReport = `insert into abuse_reports (review_id, reporter_user_id, reason, details)
 values ($1::uuid, $2::uuid, $3, $4)
 on conflict (review_id, reporter_user_id) do nothing
 returning id::text, status`

	sqlSelectAbuseReportByReviewAndReporter = `select id::text, status
   from abuse_reports
  where review_id = $1::uuid and reporter_user_id = $2::uuid`

	sqlConfirmAbuseReport = `update abuse_reports
    set status = 'confirmed',
        confirmed_by = $2::uuid,
        confirmed_at = coalesce(confirmed_at, now()),
        updated_at = now()
  where id = $1::uuid and status <> 'confirmed'
  returning review_id::text, status`

	sqlSelectAbuseReportByID = `select review_id::text, status
   from abuse_reports
  where id = $1::uuid`

	sqlSelectReviewCafeByReviewID = `select cafe_id::text from reviews where id = $1::uuid`
)

func (s *Service) ReportAbuse(ctx context.Context, userID string, reviewID string, req ReportAbuseRequest) (map[string]interface{}, error) {
	reason := strings.TrimSpace(req.Reason)
	details := strings.TrimSpace(req.Details)
	if reason == "" {
		reason = "other"
	}

	var reviewAuthorID string
	err := s.repository.Pool().QueryRow(
		ctx,
		sqlSelectReviewAuthorForAbuse,
		reviewID,
	).Scan(&reviewAuthorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if reviewAuthorID == userID {
		return nil, ErrForbidden
	}

	var reportID, status string
	err = s.repository.Pool().QueryRow(
		ctx,
		sqlInsertAbuseReport,
		reviewID,
		userID,
		reason,
		details,
	).Scan(&reportID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		err = s.repository.Pool().QueryRow(
			ctx,
			sqlSelectAbuseReportByReviewAndReporter,
			reviewID,
			userID,
		).Scan(&reportID, &status)
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	return map[string]interface{}{"report_id": reportID, "status": status}, nil
}

func (s *Service) ConfirmAbuseReport(ctx context.Context, moderatorUserID string, reportID string) (map[string]interface{}, error) {
	tx, err := s.repository.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	var (
		reviewID string
		status   string
		cafeID   string
	)

	err = tx.QueryRow(
		ctx,
		sqlConfirmAbuseReport,
		reportID,
		moderatorUserID,
	).Scan(&reviewID, &status)

	newlyConfirmed := true
	if errors.Is(err, pgx.ErrNoRows) {
		newlyConfirmed = false
		err = tx.QueryRow(
			ctx,
			sqlSelectAbuseReportByID,
			reportID,
		).Scan(&reviewID, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	err = tx.QueryRow(ctx, sqlSelectReviewCafeByReviewID, reviewID).Scan(&cafeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if newlyConfirmed {
		payload := map[string]interface{}{
			"abuse_report_id": reportID,
			"review_id":       reviewID,
			"cafe_id":         cafeID,
		}
		dedupeKey := fmt.Sprintf("abuse-confirmed:%s", reportID)
		if err := s.repository.EnqueueEventTx(ctx, tx, EventAbuseConfirmed, cafeID, dedupeKey, payload); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return map[string]interface{}{"report_id": reportID, "status": status}, nil
}
