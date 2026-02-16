package reviews

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	sqlSelectReviewPhotoUploadByTempForUpdate = `select
	id::text,
	user_id::text,
	status,
	coalesce(final_object_key, ''),
	coalesce(mime_type, ''),
	coalesce(size_bytes, 0),
	coalesce(error, '')
from review_photo_uploads
where temp_object_key = $1
for update`

	sqlInsertReviewPhotoUpload = `insert into review_photo_uploads (
	user_id,
	temp_object_key,
	status,
	mime_type,
	size_bytes
)
values ($1::uuid, $2, 'pending', $3, $4)
returning
	id::text,
	user_id::text,
	status,
	coalesce(final_object_key, ''),
	coalesce(mime_type, ''),
	coalesce(size_bytes, 0),
	coalesce(error, '')`

	sqlSelectReviewPhotoUploadByIDForUser = `select
	id::text,
	user_id::text,
	status,
	coalesce(final_object_key, ''),
	coalesce(mime_type, ''),
	coalesce(size_bytes, 0),
	coalesce(error, '')
from review_photo_uploads
where id = $1::uuid
  and user_id = $2::uuid`

	sqlMarkReviewPhotoUploadProcessing = `update review_photo_uploads
set status = 'processing',
    error = '',
    updated_at = now()
where id = $1::uuid
  and status = 'pending'
returning
	id::text,
	user_id::text,
	temp_object_key,
	coalesce(mime_type, ''),
	coalesce(size_bytes, 0)`

	sqlMarkReviewPhotoUploadReady = `update review_photo_uploads
set status = 'ready',
    final_object_key = $2,
    mime_type = $3,
    size_bytes = $4,
    error = '',
    processed_at = now(),
    updated_at = now()
where id = $1::uuid`

	sqlMarkReviewPhotoUploadFailed = `update review_photo_uploads
set status = 'failed',
    error = $2,
    updated_at = now()
where id = $1::uuid`
)

type reviewPhotoUploadState struct {
	ID             string
	UserID         string
	Status         string
	TempObjectKey  string
	FinalObjectKey string
	MimeType       string
	SizeBytes      int64
	Error          string
}

func (s *Service) EnsureReviewPhotoUploadQueued(
	ctx context.Context,
	userID string,
	tempObjectKey string,
	mimeType string,
	sizeBytes int64,
) (reviewPhotoUploadState, error) {
	var state reviewPhotoUploadState

	tx, err := s.repository.Pool().Begin(ctx)
	if err != nil {
		return state, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = tx.QueryRow(ctx, sqlSelectReviewPhotoUploadByTempForUpdate, tempObjectKey).Scan(
		&state.ID,
		&state.UserID,
		&state.Status,
		&state.FinalObjectKey,
		&state.MimeType,
		&state.SizeBytes,
		&state.Error,
	)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		err = tx.QueryRow(ctx, sqlInsertReviewPhotoUpload, userID, tempObjectKey, mimeType, sizeBytes).Scan(
			&state.ID,
			&state.UserID,
			&state.Status,
			&state.FinalObjectKey,
			&state.MimeType,
			&state.SizeBytes,
			&state.Error,
		)
		if err != nil {
			return state, err
		}
		state.TempObjectKey = tempObjectKey
	case err != nil:
		return state, err
	default:
		state.TempObjectKey = tempObjectKey
		if strings.TrimSpace(state.UserID) != strings.TrimSpace(userID) {
			return state, ErrForbidden
		}
	}

	if state.Status == "pending" {
		payload := map[string]interface{}{
			"photo_upload_id": state.ID,
		}
		// Stable dedupe key keeps only one processing event per upload row.
		dedupeKey := fmt.Sprintf("review-photo-process:%s", state.ID)
		if err := s.repository.EnqueueEventTx(
			ctx,
			tx,
			EventReviewPhotoProcessRequested,
			userID,
			dedupeKey,
			payload,
		); err != nil {
			return state, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return state, err
	}
	return state, nil
}

func (s *Service) GetReviewPhotoUploadStatus(
	ctx context.Context,
	userID string,
	uploadID string,
) (reviewPhotoUploadState, error) {
	var state reviewPhotoUploadState
	err := s.repository.Pool().QueryRow(
		ctx,
		sqlSelectReviewPhotoUploadByIDForUser,
		uploadID,
		userID,
	).Scan(
		&state.ID,
		&state.UserID,
		&state.Status,
		&state.FinalObjectKey,
		&state.MimeType,
		&state.SizeBytes,
		&state.Error,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return state, ErrNotFound
		}
		return state, err
	}
	return state, nil
}

func (s *Service) claimReviewPhotoUploadForProcessing(
	ctx context.Context,
	uploadID string,
) (reviewPhotoUploadState, bool, error) {
	var state reviewPhotoUploadState
	err := s.repository.Pool().QueryRow(
		ctx,
		sqlMarkReviewPhotoUploadProcessing,
		uploadID,
	).Scan(
		&state.ID,
		&state.UserID,
		&state.TempObjectKey,
		&state.MimeType,
		&state.SizeBytes,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return state, false, nil
	}
	if err != nil {
		return state, false, err
	}
	state.Status = "processing"
	return state, true, nil
}

func (s *Service) markReviewPhotoUploadReady(
	ctx context.Context,
	uploadID string,
	finalObjectKey string,
	mimeType string,
	sizeBytes int64,
) error {
	_, err := s.repository.Pool().Exec(
		ctx,
		sqlMarkReviewPhotoUploadReady,
		uploadID,
		finalObjectKey,
		mimeType,
		sizeBytes,
	)
	return err
}

func (s *Service) markReviewPhotoUploadFailed(ctx context.Context, uploadID string, cause error) error {
	message := "photo processing failed"
	if cause != nil {
		message = cause.Error()
	}
	_, err := s.repository.Pool().Exec(
		ctx,
		sqlMarkReviewPhotoUploadFailed,
		uploadID,
		truncateError(message),
	)
	return err
}

func isReviewPhotoReady(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "ready")
}

func isReviewPhotoFailed(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "failed")
}

func reviewPhotoStatusRetryAfter() time.Duration {
	return 1200 * time.Millisecond
}

func normalizeReviewPhotoStatus(status string) string {
	if isReviewPhotoReady(status) {
		return "ready"
	}
	if isReviewPhotoFailed(status) {
		return "failed"
	}
	if strings.EqualFold(strings.TrimSpace(status), "processing") {
		return "processing"
	}
	return "pending"
}
