package reviews

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (s *Service) processReviewPhotoUploadEvent(ctx context.Context, payload map[string]interface{}) error {
	uploadID := payloadString(payload, "photo_upload_id")
	if strings.TrimSpace(uploadID) == "" {
		return nil
	}

	state, ok, err := s.claimReviewPhotoUploadForProcessing(ctx, uploadID)
	if err != nil || !ok {
		return err
	}

	if s.mediaService == nil || !s.mediaService.Enabled() {
		_ = s.markReviewPhotoUploadFailed(ctx, uploadID, errors.New("media service is unavailable"))
		return nil
	}

	objectContent, objectMimeType, err := s.mediaService.GetObject(ctx, state.TempObjectKey)
	if err != nil {
		_ = s.markReviewPhotoUploadFailed(ctx, uploadID, err)
		return nil
	}
	if len(objectContent) == 0 {
		_ = s.markReviewPhotoUploadFailed(ctx, uploadID, errors.New("uploaded file is empty"))
		return nil
	}
	if strings.TrimSpace(objectMimeType) == "" {
		objectMimeType = state.MimeType
	}

	optimized, err := optimizeReviewPhoto(objectMimeType, objectContent)
	if err != nil {
		_ = s.markReviewPhotoUploadFailed(ctx, uploadID, err)
		return nil
	}
	if len(optimized.Content) == 0 {
		_ = s.markReviewPhotoUploadFailed(ctx, uploadID, errors.New("optimized file is empty"))
		return nil
	}

	maxBytes := s.mediaCfg.S3MaxUploadBytes
	if maxBytes <= 0 {
		maxBytes = 8 * 1024 * 1024
	}
	if int64(len(optimized.Content)) > maxBytes {
		_ = s.markReviewPhotoUploadFailed(ctx, uploadID, fmt.Errorf("optimized file exceeds max size %d", maxBytes))
		return nil
	}

	finalObjectKey := buildFinalReviewPhotoObjectKey(state.UserID, optimized.Content, optimized.ContentType)
	if err := s.mediaService.PutObject(ctx, finalObjectKey, optimized.ContentType, optimized.Content); err != nil {
		_ = s.markReviewPhotoUploadFailed(ctx, uploadID, err)
		return nil
	}

	if strings.TrimSpace(state.TempObjectKey) != "" {
		_ = s.mediaService.DeleteObject(ctx, state.TempObjectKey)
	}

	if err := s.markReviewPhotoUploadReady(
		ctx,
		uploadID,
		finalObjectKey,
		optimized.ContentType,
		int64(len(optimized.Content)),
	); err != nil {
		return err
	}
	return nil
}

func buildFinalReviewPhotoObjectKey(userID string, content []byte, contentType string) string {
	extension := contentTypeExtension(contentType)
	hashBytes := sha256.Sum256(content)
	hashPart := hex.EncodeToString(hashBytes[:8])
	return fmt.Sprintf(
		"reviews/users/%s/optimized/%d_%s%s",
		strings.TrimSpace(userID),
		time.Now().Unix(),
		hashPart,
		extension,
	)
}
