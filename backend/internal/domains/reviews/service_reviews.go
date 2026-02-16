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
	minReviewSummaryLength = 60
	defaultReviewListLimit = 20

	sqlCheckCafeExists = `select exists(select 1 from cafes where id = $1::uuid)`

	sqlSelectReviewByUserCafeForUpdate = `select id::text, status
   from reviews
  where user_id = $1::uuid and cafe_id = $2::uuid
  for update`

	sqlInsertReview = `insert into reviews (user_id, cafe_id, rating, summary, status)
 values ($1::uuid, $2::uuid, $3, $4, 'published')
 returning id::text, updated_at`

	sqlSelectReviewForUpdateByID = `select
	r.id::text,
	r.user_id::text,
	r.cafe_id::text,
	r.rating,
	r.summary,
	coalesce(nullif(ra.drink_id, ''), coalesce(ra.drink_name, '')) as drink_id,
	coalesce(ra.taste_tags, '{}'::text[])
from reviews r
left join review_attributes ra on ra.review_id = r.id
where r.id = $1::uuid and r.status = 'published'
for update`

	sqlUpdateReview = `update reviews
    set rating = $2,
        summary = $3,
        status = 'published',
        updated_at = now()
  where id = $1::uuid
  returning updated_at`

	sqlUpsertReviewAttributes = `insert into review_attributes (
	review_id,
	drink_id,
	drink_name,
	taste_tags,
	summary_length,
	summary_fingerprint,
	photo_count
)
values ($1::uuid, $2, $3, $4::text[], $5, $6, $7)
on conflict (review_id)
do update set
	drink_id = excluded.drink_id,
	drink_name = excluded.drink_name,
	taste_tags = excluded.taste_tags,
	summary_length = excluded.summary_length,
	summary_fingerprint = excluded.summary_fingerprint,
	photo_count = excluded.photo_count,
	updated_at = now()`

	sqlDeleteReviewPhotos = `delete from review_photos where review_id = $1::uuid`

	sqlInsertReviewPhoto = `insert into review_photos (review_id, photo_url, position)
 values ($1::uuid, $2, $3)`

	sqlSelectReviewPhotos = `select photo_url
   from review_photos
  where review_id = $1::uuid
  order by position asc`

	sqlExistsDuplicateSummary = `select exists(
	select 1
	  from review_attributes ra
	  join reviews r on r.id = ra.review_id
	 where r.user_id = $1::uuid
	   and r.status = 'published'
	   and ra.summary_fingerprint = $2
	   and ($3 = '' or r.id <> $3::uuid)
)`
)

const sqlListCafeReviewsBase = `select
	r.id::text,
	r.user_id::text,
	coalesce(nullif(trim(u.display_name), ''), 'Участник') as author_name,
	r.rating,
	r.summary,
	coalesce(nullif(ra.drink_id, ''), coalesce(ra.drink_name, '')) as drink_id,
	coalesce(ra.taste_tags, '{}'::text[]) as taste_tags,
	coalesce(ra.photo_count, 0) as photo_count,
	coalesce(hs.helpful_votes, 0) as helpful_votes,
	coalesce(hs.helpful_score, 0)::float8 as helpful_score,
	coalesce(vv.confidence, 'none') as visit_confidence,
	coalesce(vv.verified_at is not null and vv.confidence in ('low', 'medium', 'high'), false) as visit_verified,
	coalesce((
		select count(*)
		  from abuse_reports ar
		 where ar.review_id = r.id and ar.status = 'confirmed'
	), 0) as confirmed_reports,
	r.created_at,
	r.updated_at,
	coalesce((
		select array_agg(rp.photo_url order by rp.position asc)
		  from review_photos rp
		 where rp.review_id = r.id
	), '{}'::text[]) as photos
from reviews r
join users u on u.id = r.user_id
left join review_attributes ra on ra.review_id = r.id
left join visit_verifications vv on vv.review_id = r.id
left join lateral (
	select
		count(*) as helpful_votes,
		coalesce(sum(hv.weight), 0) as helpful_score
	  from helpful_votes hv
	 where hv.review_id = r.id
) hs on true
where r.cafe_id = $1::uuid
  and r.status = 'published'
`

var reviewSortOrderClause = map[string]string{
	"new":      "order by r.created_at desc, r.id desc",
	"helpful":  "order by hs.helpful_score desc, hs.helpful_votes desc, r.created_at desc, r.id desc",
	"verified": "order by visit_verified desc, hs.helpful_score desc, hs.helpful_votes desc, r.created_at desc, r.id desc",
}

type cafeReviewState struct {
	ReviewID   string
	UserID     string
	CafeID     string
	Rating     int
	Summary    string
	DrinkID    string
	TasteTags  []string
	Photos     []string
	UpdatedAt  time.Time
	CreatedAt  time.Time
	Status     string
	HasReview  bool
	PhotoCount int
}

func (s *Service) PublishReview(
	ctx context.Context,
	userID string,
	idempotencyKey string,
	req PublishReviewRequest,
) (idempotentResult, error) {
	return s.CreateReview(ctx, userID, idempotencyKey, req)
}

func (s *Service) CreateReview(
	ctx context.Context,
	userID string,
	idempotencyKey string,
	req PublishReviewRequest,
) (idempotentResult, error) {
	request := sanitizePublishReviewRequest(req)
	if err := validateCreateReviewRequest(request); err != nil {
		return idempotentResult{}, err
	}

	hash := requestHash(struct {
		UserID string               `json:"user_id"`
		Req    PublishReviewRequest `json:"req"`
	}{UserID: userID, Req: request})
	scope := IdempotencyScopeReviewCreate + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		if !s.allowReviewCreate(userID) {
			return 0, nil, ErrRateLimited
		}

		var cafeExists bool
		if err := tx.QueryRow(ctx, sqlCheckCafeExists, request.CafeID).Scan(&cafeExists); err != nil {
			return 0, nil, err
		}
		if !cafeExists {
			return 0, nil, ErrNotFound
		}

		var existingReviewID, existingStatus string
		err := tx.QueryRow(ctx, sqlSelectReviewByUserCafeForUpdate, userID, request.CafeID).Scan(&existingReviewID, &existingStatus)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			// continue
		case err != nil:
			return 0, nil, err
		default:
			return 0, nil, ErrAlreadyExists
		}

		if looksLikeSpamSummary(request.Summary) {
			return 0, nil, ErrSpamDetected
		}

		summaryFinger := summaryFingerprint(request.Summary)
		isDuplicate, err := s.isDuplicateSummaryTx(ctx, tx, userID, "", summaryFinger)
		if err != nil {
			return 0, nil, err
		}
		if isDuplicate {
			return 0, nil, ErrDuplicateContent
		}

		var (
			reviewID  string
			updatedAt time.Time
		)
		err = tx.QueryRow(
			ctx,
			sqlInsertReview,
			userID,
			request.CafeID,
			request.Rating,
			request.Summary,
		).Scan(&reviewID, &updatedAt)
		if err != nil {
			return 0, nil, err
		}

		if err := s.upsertReviewAttributesTx(ctx, tx, reviewID, request, summaryFinger); err != nil {
			return 0, nil, err
		}
		if err := s.replaceReviewPhotosTx(ctx, tx, reviewID, request.Photos); err != nil {
			return 0, nil, err
		}

		payload := map[string]interface{}{
			"review_id": reviewID,
			"user_id":   userID,
			"cafe_id":   request.CafeID,
		}
		// Dedupe key intentionally includes idempotency key so transport retries
		// cannot enqueue the same business event twice.
		dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventReviewCreated)
		if err := s.repository.EnqueueEventTx(ctx, tx, EventReviewCreated, request.CafeID, dedupeKey, payload); err != nil {
			return 0, nil, err
		}

		response := map[string]interface{}{
			"review_id":  reviewID,
			"cafe_id":    request.CafeID,
			"event_type": EventReviewCreated,
			"created":    true,
			"updated_at": updatedAt.UTC().Format(time.RFC3339),
		}
		return 201, response, nil
	})
}

func (s *Service) UpdateReview(
	ctx context.Context,
	userID string,
	reviewID string,
	idempotencyKey string,
	req UpdateReviewRequest,
) (idempotentResult, error) {
	hash := requestHash(struct {
		UserID   string              `json:"user_id"`
		ReviewID string              `json:"review_id"`
		Req      UpdateReviewRequest `json:"req"`
	}{UserID: userID, ReviewID: reviewID, Req: req})
	scope := IdempotencyScopeReviewUpdate + ":" + userID

	return s.repository.RunIdempotent(ctx, scope, idempotencyKey, hash, func(tx pgx.Tx) (int, map[string]interface{}, error) {
		if !s.allowReviewUpdate(userID) {
			return 0, nil, ErrRateLimited
		}

		state, err := s.loadReviewStateForUpdateTx(ctx, tx, reviewID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return 0, nil, ErrNotFound
			}
			return 0, nil, err
		}
		if state.UserID != userID {
			return 0, nil, ErrForbidden
		}

		next := state
		if req.Rating != nil {
			next.Rating = *req.Rating
		}
		if req.DrinkID != nil {
			next.DrinkID = strings.TrimSpace(*req.DrinkID)
		}
		if req.TasteTags != nil {
			next.TasteTags = normalizeTags(*req.TasteTags)
		}
		if req.Summary != nil {
			next.Summary = strings.TrimSpace(*req.Summary)
		}
		if req.Photos != nil {
			next.Photos = normalizePhotos(*req.Photos)
		}

		if err := validateEffectiveReviewState(next, req.Summary != nil); err != nil {
			return 0, nil, err
		}
		if req.Summary != nil && looksLikeSpamSummary(next.Summary) {
			return 0, nil, ErrSpamDetected
		}

		summaryFinger := summaryFingerprint(next.Summary)
		isDuplicate, err := s.isDuplicateSummaryTx(ctx, tx, userID, state.ReviewID, summaryFinger)
		if err != nil {
			return 0, nil, err
		}
		if isDuplicate {
			return 0, nil, ErrDuplicateContent
		}

		updatedAt, err := s.updateReviewCoreTx(ctx, tx, state.ReviewID, next.Rating, next.Summary)
		if err != nil {
			return 0, nil, err
		}
		next.UpdatedAt = updatedAt

		if err := s.upsertReviewAttributesTx(ctx, tx, state.ReviewID, PublishReviewRequest{
			CafeID:    state.CafeID,
			Rating:    next.Rating,
			DrinkID:   next.DrinkID,
			TasteTags: next.TasteTags,
			Summary:   next.Summary,
			Photos:    next.Photos,
		}, summaryFinger); err != nil {
			return 0, nil, err
		}
		if req.Photos != nil {
			if err := s.replaceReviewPhotosTx(ctx, tx, state.ReviewID, next.Photos); err != nil {
				return 0, nil, err
			}
		}

		payload := map[string]interface{}{
			"review_id": state.ReviewID,
			"user_id":   userID,
			"cafe_id":   state.CafeID,
		}
		dedupeKey := fmt.Sprintf("%s:%s:%s", scope, idempotencyKey, EventReviewUpdated)
		if err := s.repository.EnqueueEventTx(ctx, tx, EventReviewUpdated, state.CafeID, dedupeKey, payload); err != nil {
			return 0, nil, err
		}

		response := map[string]interface{}{
			"review_id":  state.ReviewID,
			"cafe_id":    state.CafeID,
			"event_type": EventReviewUpdated,
			"created":    false,
			"updated_at": updatedAt.UTC().Format(time.RFC3339),
		}
		return 200, response, nil
	})
}

func (s *Service) ListCafeReviews(
	ctx context.Context,
	cafeID string,
	sortBy string,
	offset int,
	limit int,
) ([]map[string]interface{}, bool, int, error) {
	if limit <= 0 {
		limit = defaultReviewListLimit
	}
	if offset < 0 {
		offset = 0
	}

	orderClause, ok := reviewSortOrderClause[sortBy]
	if !ok {
		orderClause = reviewSortOrderClause["new"]
	}
	// Offset-based cursor pagination keeps API simple while preserving stable ordering.
	query := sqlListCafeReviewsBase + "\n" + orderClause + "\noffset $2 limit $3"
	fetchLimit := limit + 1

	rows, err := s.repository.Pool().Query(ctx, query, cafeID, offset, fetchLimit)
	if err != nil {
		return nil, false, offset, err
	}
	defer rows.Close()

	result := make([]map[string]interface{}, 0, fetchLimit)
	for rows.Next() {
		var (
			item             cafeReviewState
			authorName       string
			tasteTags        []string
			helpfulVotes     int
			helpfulScore     float64
			visitConfidence  string
			visitVerified    bool
			confirmedReports int
			reviewPhotos     []string
		)

		if err := rows.Scan(
			&item.ReviewID,
			&item.UserID,
			&authorName,
			&item.Rating,
			&item.Summary,
			&item.DrinkID,
			&tasteTags,
			&item.PhotoCount,
			&helpfulVotes,
			&helpfulScore,
			&visitConfidence,
			&visitVerified,
			&confirmedReports,
			&item.CreatedAt,
			&item.UpdatedAt,
			&reviewPhotos,
		); err != nil {
			return nil, false, offset, err
		}

		qualityScore := calculateReviewQualityV1(
			item.DrinkID,
			len(tasteTags),
			utfRuneLen(item.Summary),
			len(reviewPhotos),
			visitConfidence,
			confirmedReports,
		)

		result = append(result, map[string]interface{}{
			"id":                item.ReviewID,
			"user_id":           item.UserID,
			"author_name":       authorName,
			"rating":            item.Rating,
			"summary":           item.Summary,
			"drink_id":          item.DrinkID,
			"taste_tags":        tasteTags,
			"photos":            reviewPhotos,
			"photo_count":       len(reviewPhotos),
			"helpful_votes":     helpfulVotes,
			"helpful_score":     roundFloat(helpfulScore, 3),
			"visit_confidence":  visitConfidence,
			"visit_verified":    visitVerified,
			"quality_score":     qualityScore,
			"confirmed_reports": confirmedReports,
			"created_at":        item.CreatedAt.UTC().Format(time.RFC3339),
			"updated_at":        item.UpdatedAt.UTC().Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, false, offset, err
	}

	hasMore := len(result) > limit
	if hasMore {
		result = result[:limit]
	}
	nextOffset := offset + len(result)

	return result, hasMore, nextOffset, nil
}

func validateCreateReviewRequest(req PublishReviewRequest) error {
	if strings.TrimSpace(req.CafeID) == "" {
		return ErrConflict
	}
	if req.Rating < 1 || req.Rating > 5 {
		return ErrConflict
	}
	if strings.TrimSpace(req.DrinkID) == "" {
		return ErrConflict
	}
	if utfRuneLen(req.Summary) < minReviewSummaryLength {
		return ErrConflict
	}
	for _, photo := range req.Photos {
		if !validPhotoURL(photo) {
			return ErrConflict
		}
	}
	return nil
}

func validateEffectiveReviewState(state cafeReviewState, enforceSummaryMin bool) error {
	if state.Rating < 1 || state.Rating > 5 {
		return ErrConflict
	}
	if strings.TrimSpace(state.DrinkID) == "" {
		return ErrConflict
	}
	if enforceSummaryMin && utfRuneLen(state.Summary) < minReviewSummaryLength {
		return ErrConflict
	}
	for _, photo := range state.Photos {
		if !validPhotoURL(photo) {
			return ErrConflict
		}
	}
	return nil
}

func (s *Service) allowReviewCreate(userID string) bool {
	if s.createLimiter == nil {
		return true
	}
	return s.createLimiter.Allow(strings.TrimSpace(userID))
}

func (s *Service) allowReviewUpdate(userID string) bool {
	if s.updateLimiter == nil {
		return true
	}
	return s.updateLimiter.Allow(strings.TrimSpace(userID))
}

func (s *Service) isDuplicateSummaryTx(
	ctx context.Context,
	tx pgx.Tx,
	userID string,
	excludeReviewID string,
	fingerprint string,
) (bool, error) {
	if strings.TrimSpace(fingerprint) == "" {
		return false, nil
	}
	var exists bool
	err := tx.QueryRow(ctx, sqlExistsDuplicateSummary, userID, fingerprint, strings.TrimSpace(excludeReviewID)).Scan(&exists)
	return exists, err
}

func (s *Service) loadReviewStateForUpdateTx(ctx context.Context, tx pgx.Tx, reviewID string) (cafeReviewState, error) {
	var state cafeReviewState
	err := tx.QueryRow(ctx, sqlSelectReviewForUpdateByID, reviewID).Scan(
		&state.ReviewID,
		&state.UserID,
		&state.CafeID,
		&state.Rating,
		&state.Summary,
		&state.DrinkID,
		&state.TasteTags,
	)
	if err != nil {
		return state, err
	}

	rows, err := tx.Query(ctx, sqlSelectReviewPhotos, state.ReviewID)
	if err != nil {
		return state, err
	}
	defer rows.Close()

	photos := make([]string, 0, 4)
	for rows.Next() {
		var photoURL string
		if err := rows.Scan(&photoURL); err != nil {
			return state, err
		}
		photos = append(photos, strings.TrimSpace(photoURL))
	}
	if err := rows.Err(); err != nil {
		return state, err
	}
	state.Photos = photos
	state.PhotoCount = len(photos)
	return state, nil
}

func (s *Service) updateReviewCoreTx(
	ctx context.Context,
	tx pgx.Tx,
	reviewID string,
	rating int,
	summary string,
) (time.Time, error) {
	var updatedAt time.Time
	err := tx.QueryRow(ctx, sqlUpdateReview, reviewID, rating, summary).Scan(&updatedAt)
	return updatedAt, err
}

func (s *Service) upsertReviewAttributesTx(
	ctx context.Context,
	tx pgx.Tx,
	reviewID string,
	req PublishReviewRequest,
	summaryFinger string,
) error {
	summaryLen := utfRuneLen(req.Summary)
	_, err := tx.Exec(
		ctx,
		sqlUpsertReviewAttributes,
		reviewID,
		req.DrinkID,
		req.DrinkID,
		req.TasteTags,
		summaryLen,
		summaryFinger,
		len(req.Photos),
	)
	return err
}

func (s *Service) replaceReviewPhotosTx(
	ctx context.Context,
	tx pgx.Tx,
	reviewID string,
	photos []string,
) error {
	if _, err := tx.Exec(ctx, sqlDeleteReviewPhotos, reviewID); err != nil {
		return err
	}
	for idx, photoURL := range photos {
		if _, err := tx.Exec(ctx, sqlInsertReviewPhoto, reviewID, photoURL, idx+1); err != nil {
			return err
		}
	}
	return nil
}
