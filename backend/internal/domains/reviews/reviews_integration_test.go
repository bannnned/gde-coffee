package reviews

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"backend/internal/config"
	dbmigrations "backend/migrations"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	integrationPoolOnce sync.Once
	integrationPool     *pgxpool.Pool
	integrationPoolErr  error
)

func integrationTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dbURL := strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	usingFallback := false
	if dbURL == "" {
		for _, key := range []string{"DATABASE_URL", "DATABASE_URL_2", "DATABASE_URL_3"} {
			value := strings.TrimSpace(os.Getenv(key))
			if value == "" {
				continue
			}
			dbURL = value
			usingFallback = true
			break
		}
	}
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL and DATABASE_URL* are not set; skipping DB integration tests")
	}
	if usingFallback {
		t.Log("TEST_DATABASE_URL is not set, using DATABASE_URL fallback for integration tests")
	}

	integrationPoolOnce.Do(func() {
		if err := dbmigrations.Run(dbURL); err != nil {
			integrationPoolErr = fmt.Errorf("run migrations: %w", err)
			return
		}
		pool, err := pgxpool.New(context.Background(), dbURL)
		if err != nil {
			integrationPoolErr = fmt.Errorf("create pool: %w", err)
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			integrationPoolErr = fmt.Errorf("ping pool: %w", err)
			pool.Close()
			return
		}
		integrationPool = pool
	})

	if integrationPoolErr != nil {
		t.Fatalf("integration pool init failed: %v", integrationPoolErr)
	}
	return integrationPool
}

func newIntegrationRouter(pool *pgxpool.Pool) *gin.Engine {
	gin.SetMode(gin.TestMode)
	repository := NewRepository(pool)
	service := NewService(repository)
	handler := NewHandler(service, nil, config.MediaConfig{})

	router := gin.New()
	router.Use(func(c *gin.Context) {
		if userID := strings.TrimSpace(c.GetHeader("X-Test-User-ID")); userID != "" {
			c.Set("user_id", userID)
		}
		if role := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Test-Role"))); role != "" {
			c.Set("user_role", role)
		}
		c.Next()
	})

	router.POST("/api/reviews", handler.Create)
	router.PATCH("/api/reviews/:id", handler.Update)
	router.POST("/api/reviews/:id/helpful", handler.AddHelpful)
	router.POST("/api/cafes/:id/check-in/start", handler.StartCheckIn)
	router.POST("/api/reviews/:id/visit/verify", handler.VerifyVisit)
	router.GET("/api/cafes/:id/reviews", handler.ListCafeReviews)
	moderationReviews := router.Group("/api/reviews")
	moderationReviews.Use(testRequireRoles("admin", "moderator"))
	moderationReviews.DELETE("/:id", handler.DeleteReview)

	admin := router.Group("/api/admin/drinks")
	admin.Use(testRequireRoles("admin", "moderator"))
	admin.POST("/unknown/:id/map", handler.MapUnknownDrink)

	adminCafes := router.Group("/api/admin/cafes")
	adminCafes.Use(testRequireRoles("admin", "moderator"))
	adminCafes.GET("/:id/rating-diagnostics", handler.GetCafeRatingDiagnostics)

	return router
}

func testRequireRoles(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		next := strings.ToLower(strings.TrimSpace(role))
		if next == "" {
			continue
		}
		allowed[next] = struct{}{}
	}
	return func(c *gin.Context) {
		role := strings.ToLower(strings.TrimSpace(c.GetString("user_role")))
		if _, ok := allowed[role]; !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    "forbidden",
				"message": "insufficient role",
			})
			return
		}
		c.Next()
	}
}

func performJSONRequest(
	t *testing.T,
	router *gin.Engine,
	method string,
	path string,
	headers map[string]string,
	payload interface{},
) *httptest.ResponseRecorder {
	t.Helper()

	var body []byte
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		body = raw
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func mustCreateTestUser(t *testing.T, pool *pgxpool.Pool, role string) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	email := fmt.Sprintf("reviews-it-%d@example.com", time.Now().UnixNano())
	var id string
	err := pool.QueryRow(
		ctx,
		`insert into users (email_normalized, display_name, role)
		 values ($1, $2, $3)
		 returning id::text`,
		email,
		"it user",
		strings.ToLower(strings.TrimSpace(role)),
	).Scan(&id)
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	return id
}

func mustCreateTestCafe(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var id string
	err := pool.QueryRow(
		ctx,
		`insert into cafes (name, lat, lng, address)
		 values ($1, $2, $3, $4)
		 returning id::text`,
		fmt.Sprintf("test cafe %d", time.Now().UnixNano()),
		55.751244,
		37.618423,
		"integration test",
	).Scan(&id)
	if err != nil {
		t.Fatalf("create cafe: %v", err)
	}
	return id
}

func mustExec(t *testing.T, pool *pgxpool.Pool, query string, args ...interface{}) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := pool.Exec(ctx, query, args...); err != nil {
		t.Fatalf("exec query failed: %v", err)
	}
}

func mustDeleteTestUser(t *testing.T, pool *pgxpool.Pool, userID string) {
	t.Helper()
	if strings.TrimSpace(userID) == "" {
		return
	}
	mustExec(t, pool, `delete from users where id = $1::uuid`, userID)
}

func mustDeleteTestCafe(t *testing.T, pool *pgxpool.Pool, cafeID string) {
	t.Helper()
	if strings.TrimSpace(cafeID) == "" {
		return
	}
	mustExec(t, pool, `delete from cafes where id = $1::uuid`, cafeID)
}

func TestReviewsCreateWithUnknownDrink(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	userID := mustCreateTestUser(t, pool, "user")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustExec(t, pool, `delete from drink_unknown_formats where name = $1`, "v-60 sparkling tonic")
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	rec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":    userID,
			"Idempotency-Key":   fmt.Sprintf("it-create-%d", time.Now().UnixNano()),
			"X-Test-Role":       "user",
			"X-Requested-By-IT": "true",
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     5,
			"drink":      "  V-60  Sparkling   Tonic ",
			"taste_tags": []string{"acidity", "berries"},
			"summary":    "Очень яркая чашка с ягодной кислотностью, чистым телом и длинным послевкусием. Вернусь повторно.",
			"photos":     []string{},
		},
	)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d, body=%s", rec.Code, rec.Body.String())
	}

	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if strings.TrimSpace(createResp.ReviewID) == "" {
		t.Fatalf("review_id is empty in response: %s", rec.Body.String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var drinkID, drinkName string
	if err := pool.QueryRow(
		ctx,
		`select coalesce(drink_id, ''), coalesce(drink_name, '')
		   from review_attributes
		  where review_id = $1::uuid`,
		createResp.ReviewID,
	).Scan(&drinkID, &drinkName); err != nil {
		t.Fatalf("load review_attributes: %v", err)
	}
	if strings.TrimSpace(drinkID) != "" {
		t.Fatalf("expected empty drink_id for unknown drink, got %q", drinkID)
	}
	if drinkName != "v-60 sparkling tonic" {
		t.Fatalf("expected normalized drink_name, got %q", drinkName)
	}

	var mentions int
	var status string
	if err := pool.QueryRow(
		ctx,
		`select mentions_count, status
		   from drink_unknown_formats
		  where name = $1`,
		"v-60 sparkling tonic",
	).Scan(&mentions, &status); err != nil {
		t.Fatalf("load drink_unknown_formats: %v", err)
	}
	if mentions < 1 {
		t.Fatalf("expected mentions_count >= 1, got %d", mentions)
	}
	if status != "new" {
		t.Fatalf("expected status=new, got %q", status)
	}
}

func TestReviewsPatchWithUnknownDrink(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	userID := mustCreateTestUser(t, pool, "user")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustExec(t, pool, `delete from drink_unknown_formats where name = $1`, "filter fusion 2026")
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-patch-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     4,
			"drink_id":   "espresso",
			"taste_tags": []string{"chocolate"},
			"summary":    "Сбалансированный эспрессо с выраженной сладостью, хорошей структурой и чистым послевкусием без горечи.",
			"photos":     []string{},
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if strings.TrimSpace(createResp.ReviewID) == "" {
		t.Fatalf("empty review_id: %s", createRec.Body.String())
	}

	patchRec := performJSONRequest(
		t,
		router,
		http.MethodPatch,
		"/api/reviews/"+createResp.ReviewID,
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-patch-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"drink": "  filter fusion   2026 ",
		},
	)
	if patchRec.Code != http.StatusOK {
		t.Fatalf("patch expected 200, got %d, body=%s", patchRec.Code, patchRec.Body.String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var drinkID, drinkName string
	if err := pool.QueryRow(
		ctx,
		`select coalesce(drink_id, ''), coalesce(drink_name, '')
		   from review_attributes
		  where review_id = $1::uuid`,
		createResp.ReviewID,
	).Scan(&drinkID, &drinkName); err != nil {
		t.Fatalf("load review_attributes after patch: %v", err)
	}
	if strings.TrimSpace(drinkID) != "" {
		t.Fatalf("expected empty drink_id for unknown drink after patch, got %q", drinkID)
	}
	if drinkName != "filter fusion 2026" {
		t.Fatalf("expected normalized drink_name after patch, got %q", drinkName)
	}

	var mentions int
	if err := pool.QueryRow(
		ctx,
		`select mentions_count
		   from drink_unknown_formats
		  where name = $1`,
		"filter fusion 2026",
	).Scan(&mentions); err != nil {
		t.Fatalf("load unknown format after patch: %v", err)
	}
	if mentions < 1 {
		t.Fatalf("expected mentions_count >= 1, got %d", mentions)
	}
}

func TestReviewsCreateWithMultiplePositionsAndFilter(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	userID := mustCreateTestUser(t, pool, "user")
	cafeID := mustCreateTestCafe(t, pool)
	unknownName := "ultra bloom 2026"
	t.Cleanup(func() {
		mustExec(t, pool, `delete from drink_unknown_formats where name = $1`, unknownName)
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-multi-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id": cafeID,
			"rating":  5,
			"positions": []map[string]string{
				{"drink_id": "espresso"},
				{"drink": unknownName},
			},
			"taste_tags": []string{"sweet", "berries"},
			"summary":    "Очень сочная чашка: в эспрессо плотное тело и сладость, в альтернативе раскрылись ягоды и чистая кислотность без дефектов.",
			"photos":     []string{},
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if strings.TrimSpace(createResp.ReviewID) == "" {
		t.Fatalf("empty review_id: %s", createRec.Body.String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var positionsCount int
	if err := pool.QueryRow(
		ctx,
		`select count(*)
		   from review_positions
		  where review_id = $1::uuid`,
		createResp.ReviewID,
	).Scan(&positionsCount); err != nil {
		t.Fatalf("count review positions: %v", err)
	}
	if positionsCount != 2 {
		t.Fatalf("expected 2 positions, got %d", positionsCount)
	}

	listAllRec := performJSONRequest(
		t,
		router,
		http.MethodGet,
		"/api/cafes/"+cafeID+"/reviews?sort=new",
		nil,
		nil,
	)
	if listAllRec.Code != http.StatusOK {
		t.Fatalf("list all expected 200, got %d, body=%s", listAllRec.Code, listAllRec.Body.String())
	}

	var listAllBody struct {
		Reviews []struct {
			ID        string `json:"id"`
			Positions []struct {
				DrinkID   string `json:"drink_id"`
				DrinkName string `json:"drink_name"`
			} `json:"positions"`
		} `json:"reviews"`
		PositionOptions []struct {
			Key string `json:"key"`
		} `json:"position_options"`
	}
	if err := json.Unmarshal(listAllRec.Body.Bytes(), &listAllBody); err != nil {
		t.Fatalf("decode list all body: %v", err)
	}
	if len(listAllBody.Reviews) != 1 {
		t.Fatalf("expected 1 review in list, got %d", len(listAllBody.Reviews))
	}
	if len(listAllBody.Reviews[0].Positions) != 2 {
		t.Fatalf("expected review to include 2 positions, got %d", len(listAllBody.Reviews[0].Positions))
	}
	if len(listAllBody.PositionOptions) < 2 {
		t.Fatalf("expected at least 2 position options, got %d", len(listAllBody.PositionOptions))
	}

	listFilteredRec := performJSONRequest(
		t,
		router,
		http.MethodGet,
		"/api/cafes/"+cafeID+"/reviews?sort=new&position=espresso",
		nil,
		nil,
	)
	if listFilteredRec.Code != http.StatusOK {
		t.Fatalf("list filtered expected 200, got %d, body=%s", listFilteredRec.Code, listFilteredRec.Body.String())
	}

	var listFilteredBody struct {
		Reviews []struct {
			ID string `json:"id"`
		} `json:"reviews"`
		Position string `json:"position"`
	}
	if err := json.Unmarshal(listFilteredRec.Body.Bytes(), &listFilteredBody); err != nil {
		t.Fatalf("decode list filtered body: %v", err)
	}
	if listFilteredBody.Position != "espresso" {
		t.Fatalf("expected position=espresso in response, got %q", listFilteredBody.Position)
	}
	if len(listFilteredBody.Reviews) != 1 {
		t.Fatalf("expected filtered list to have 1 review, got %d", len(listFilteredBody.Reviews))
	}
}

func TestAdminMapUnknownDrinkFormatEndpoint(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	adminUserID := mustCreateTestUser(t, pool, "admin")
	unknownName := fmt.Sprintf("rare map brew %d", time.Now().UnixNano())
	drinkID := fmt.Sprintf("it-map-%d", time.Now().UnixNano())
	drinkName := fmt.Sprintf("it map drink %d", time.Now().UnixNano())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var unknownID int64
	if err := pool.QueryRow(
		ctx,
		`insert into drink_unknown_formats (name, mentions_count, first_seen_at, last_seen_at, status)
		 values ($1, 3, now(), now(), 'new')
		 returning id`,
		unknownName,
	).Scan(&unknownID); err != nil {
		t.Fatalf("insert unknown format: %v", err)
	}

	if _, err := pool.Exec(
		ctx,
		`insert into drinks (id, name, aliases, description, category, popularity_rank, is_active, created_at, updated_at)
		 values ($1, $2, '{}'::text[], '', 'test', 100, true, now(), now())`,
		drinkID,
		drinkName,
	); err != nil {
		t.Fatalf("insert target drink: %v", err)
	}

	t.Cleanup(func() {
		mustExec(t, pool, `delete from drink_unknown_formats where id = $1`, unknownID)
		mustExec(t, pool, `delete from drinks where id = $1`, drinkID)
		mustDeleteTestUser(t, pool, adminUserID)
	})

	mapRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		fmt.Sprintf("/api/admin/drinks/unknown/%d/map", unknownID),
		map[string]string{
			"X-Test-User-ID": adminUserID,
			"X-Test-Role":    "admin",
		},
		map[string]interface{}{
			"drink_id":  drinkID,
			"add_alias": true,
		},
	)
	if mapRec.Code != http.StatusOK {
		t.Fatalf("map expected 200, got %d, body=%s", mapRec.Code, mapRec.Body.String())
	}

	var mapResp struct {
		Unknown struct {
			Status        string `json:"status"`
			MappedDrinkID string `json:"mapped_drink_id"`
		} `json:"unknown"`
	}
	if err := json.Unmarshal(mapRec.Body.Bytes(), &mapResp); err != nil {
		t.Fatalf("decode map response: %v", err)
	}
	if mapResp.Unknown.Status != "mapped" {
		t.Fatalf("expected response status=mapped, got %q", mapResp.Unknown.Status)
	}
	if mapResp.Unknown.MappedDrinkID != drinkID {
		t.Fatalf("expected response mapped_drink_id=%q, got %q", drinkID, mapResp.Unknown.MappedDrinkID)
	}

	var (
		status       string
		mappedDrink  string
		drinkAliases []string
	)
	if err := pool.QueryRow(
		ctx,
		`select status, coalesce(mapped_drink_id, '')
		   from drink_unknown_formats
		  where id = $1`,
		unknownID,
	).Scan(&status, &mappedDrink); err != nil {
		t.Fatalf("load unknown after map: %v", err)
	}
	if status != "mapped" {
		t.Fatalf("expected persisted status=mapped, got %q", status)
	}
	if mappedDrink != drinkID {
		t.Fatalf("expected persisted mapped_drink_id=%q, got %q", drinkID, mappedDrink)
	}

	if err := pool.QueryRow(
		ctx,
		`select aliases
		   from drinks
		  where id = $1`,
		drinkID,
	).Scan(&drinkAliases); err != nil {
		t.Fatalf("load drink aliases after map: %v", err)
	}
	foundAlias := false
	for _, alias := range drinkAliases {
		if alias == unknownName {
			foundAlias = true
			break
		}
	}
	if !foundAlias {
		t.Fatalf("expected alias %q to be added, got aliases=%v", unknownName, drinkAliases)
	}
}

func TestDeleteReviewByModeratorOnly(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	userID := mustCreateTestUser(t, pool, "user")
	moderatorID := mustCreateTestUser(t, pool, "moderator")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, moderatorID)
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-delete-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     5,
			"drink_id":   "espresso",
			"taste_tags": []string{"sweet"},
			"summary":    "Ровный эспрессо с карамельной сладостью, чистой кислотностью и приятным балансом без лишней горечи.",
			"photos":     []string{},
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}
	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if strings.TrimSpace(createResp.ReviewID) == "" {
		t.Fatalf("empty review_id: %s", createRec.Body.String())
	}

	userDeleteRec := performJSONRequest(
		t,
		router,
		http.MethodDelete,
		"/api/reviews/"+createResp.ReviewID,
		map[string]string{
			"X-Test-User-ID": userID,
			"X-Test-Role":    "user",
		},
		nil,
	)
	if userDeleteRec.Code != http.StatusForbidden {
		t.Fatalf("user delete expected 403, got %d, body=%s", userDeleteRec.Code, userDeleteRec.Body.String())
	}

	modDeleteRec := performJSONRequest(
		t,
		router,
		http.MethodDelete,
		"/api/reviews/"+createResp.ReviewID,
		map[string]string{
			"X-Test-User-ID": moderatorID,
			"X-Test-Role":    "moderator",
		},
		map[string]interface{}{
			"reason":  "violation",
			"details": "manual moderation",
		},
	)
	if modDeleteRec.Code != http.StatusOK {
		t.Fatalf("moderator delete expected 200, got %d, body=%s", modDeleteRec.Code, modDeleteRec.Body.String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var status string
	if err := pool.QueryRow(
		ctx,
		`select status from reviews where id = $1::uuid`,
		createResp.ReviewID,
	).Scan(&status); err != nil {
		t.Fatalf("load review status after delete: %v", err)
	}
	if status != "removed" {
		t.Fatalf("expected review status=removed, got %q", status)
	}

	var (
		eventType string
		points    int
	)
	if err := pool.QueryRow(
		ctx,
		`select event_type, points
		   from reputation_events
		  where user_id = $1::uuid
		    and source_type = 'review_moderation'
		    and source_id = $2
		  order by id desc
		  limit 1`,
		userID,
		createResp.ReviewID,
	).Scan(&eventType, &points); err != nil {
		t.Fatalf("load review moderation reputation event: %v", err)
	}
	if eventType != "review_removed_violation" {
		t.Fatalf("expected review_removed_violation event, got %q", eventType)
	}
	if points != -15 {
		t.Fatalf("expected points=-15, got %d", points)
	}
}

func TestDeleteReviewRequiresReason(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	userID := mustCreateTestUser(t, pool, "user")
	moderatorID := mustCreateTestUser(t, pool, "moderator")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, moderatorID)
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-delete-reason-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     5,
			"drink_id":   "espresso",
			"taste_tags": []string{"sweet"},
			"summary":    "Стабильная чашка с карамельной сладостью, округлым телом и аккуратной кислотностью без резких тонов.",
			"photos":     []string{},
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}
	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	deleteRec := performJSONRequest(
		t,
		router,
		http.MethodDelete,
		"/api/reviews/"+createResp.ReviewID,
		map[string]string{
			"X-Test-User-ID": moderatorID,
			"X-Test-Role":    "moderator",
		},
		nil,
	)
	if deleteRec.Code != http.StatusBadRequest {
		t.Fatalf("delete without reason expected 400, got %d, body=%s", deleteRec.Code, deleteRec.Body.String())
	}
}

func TestAddHelpfulVoteEndpoint(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	authorID := mustCreateTestUser(t, pool, "user")
	voterID := mustCreateTestUser(t, pool, "user")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, voterID)
		mustDeleteTestUser(t, pool, authorID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  authorID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-helpful-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     5,
			"drink_id":   "espresso",
			"taste_tags": []string{"sweet", "chocolate"},
			"summary":    "Яркий эспрессо с чистой сладостью, отчетливыми нотами какао и сбалансированной кислотностью без резкости.",
			"photos":     []string{},
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}
	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	helpfulRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews/"+createResp.ReviewID+"/helpful",
		map[string]string{
			"X-Test-User-ID":  voterID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-helpful-%d", time.Now().UnixNano()),
		},
		nil,
	)
	if helpfulRec.Code != http.StatusOK {
		t.Fatalf("helpful expected 200, got %d, body=%s", helpfulRec.Code, helpfulRec.Body.String())
	}

	var helpfulResp struct {
		VoteID        string  `json:"vote_id"`
		ReviewID      string  `json:"review_id"`
		Weight        float64 `json:"weight"`
		AlreadyExists bool    `json:"already_exists"`
	}
	if err := json.Unmarshal(helpfulRec.Body.Bytes(), &helpfulResp); err != nil {
		t.Fatalf("decode helpful response: %v", err)
	}
	if strings.TrimSpace(helpfulResp.VoteID) == "" {
		t.Fatalf("vote_id is empty: body=%s", helpfulRec.Body.String())
	}
	if helpfulResp.ReviewID != createResp.ReviewID {
		t.Fatalf("review_id mismatch: want=%s got=%s", createResp.ReviewID, helpfulResp.ReviewID)
	}
	if helpfulResp.AlreadyExists {
		t.Fatalf("expected already_exists=false on first vote")
	}
	if helpfulResp.Weight < 0.8 || helpfulResp.Weight > 1.5 {
		t.Fatalf("expected vote weight in [0.8,1.5], got %f", helpfulResp.Weight)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var (
		votesCount int
		maxWeight  float64
	)
	if err := pool.QueryRow(
		ctx,
		`select count(*), coalesce(max(weight), 0)::float8
		   from helpful_votes
		  where review_id = $1::uuid`,
		createResp.ReviewID,
	).Scan(&votesCount, &maxWeight); err != nil {
		t.Fatalf("load helpful votes: %v", err)
	}
	if votesCount != 1 {
		t.Fatalf("expected 1 helpful vote, got %d", votesCount)
	}
	if maxWeight < 0.8 || maxWeight > 1.5 {
		t.Fatalf("persisted vote weight expected in [0.8,1.5], got %f", maxWeight)
	}

	againRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews/"+createResp.ReviewID+"/helpful",
		map[string]string{
			"X-Test-User-ID":  voterID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-helpful-repeat-%d", time.Now().UnixNano()),
		},
		nil,
	)
	if againRec.Code != http.StatusOK {
		t.Fatalf("repeat helpful expected 200, got %d, body=%s", againRec.Code, againRec.Body.String())
	}
	var againResp struct {
		AlreadyExists bool `json:"already_exists"`
	}
	if err := json.Unmarshal(againRec.Body.Bytes(), &againResp); err != nil {
		t.Fatalf("decode repeat helpful response: %v", err)
	}
	if !againResp.AlreadyExists {
		t.Fatalf("expected already_exists=true on duplicate vote")
	}
}

func TestCheckInStartAndVerifyVisitFlow(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	userID := mustCreateTestUser(t, pool, "user")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-checkin-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     5,
			"drink_id":   "espresso",
			"taste_tags": []string{"sweet"},
			"summary":    "Сбалансированная чашка с аккуратной сладостью, выраженной кислотностью и чистым послевкусием без дефектов.",
			"photos":     []string{},
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}
	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	startRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/cafes/"+cafeID+"/check-in/start",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-checkin-start-%d", time.Now().UnixNano()),
			"User-Agent":      "it-agent",
		},
		map[string]interface{}{
			"lat":    55.751244,
			"lng":    37.618423,
			"source": "integration",
		},
	)
	if startRec.Code != http.StatusOK {
		t.Fatalf("check-in start expected 200, got %d, body=%s", startRec.Code, startRec.Body.String())
	}
	var startResp struct {
		CheckInID string `json:"checkin_id"`
	}
	if err := json.Unmarshal(startRec.Body.Bytes(), &startResp); err != nil {
		t.Fatalf("decode check-in start response: %v", err)
	}
	if strings.TrimSpace(startResp.CheckInID) == "" {
		t.Fatalf("empty checkin_id in response: %s", startRec.Body.String())
	}

	// Fast-forward dwell timer for deterministic integration test.
	mustExec(
		t,
		pool,
		`update review_checkins
		    set started_at = now() - interval '6 minutes',
		        updated_at = now() - interval '6 minutes'
		  where id = $1::uuid`,
		startResp.CheckInID,
	)

	verifyRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews/"+createResp.ReviewID+"/visit/verify",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-checkin-verify-%d", time.Now().UnixNano()),
			"User-Agent":      "it-agent",
		},
		map[string]interface{}{
			"checkin_id": startResp.CheckInID,
			"lat":        55.751250,
			"lng":        37.618420,
		},
	)
	if verifyRec.Code != http.StatusOK {
		t.Fatalf("verify visit expected 200, got %d, body=%s", verifyRec.Code, verifyRec.Body.String())
	}
	var verifyResp struct {
		Confidence string `json:"confidence"`
	}
	if err := json.Unmarshal(verifyRec.Body.Bytes(), &verifyResp); err != nil {
		t.Fatalf("decode verify response: %v", err)
	}
	if verifyResp.Confidence == "none" || strings.TrimSpace(verifyResp.Confidence) == "" {
		t.Fatalf("expected non-none confidence, got %q", verifyResp.Confidence)
	}
}

func TestCheckInCrossCafeCooldown(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	userID := mustCreateTestUser(t, pool, "user")
	cafeA := mustCreateTestCafe(t, pool)
	cafeB := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeA)
		mustDeleteTestCafe(t, pool, cafeB)
	})

	firstRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/cafes/"+cafeA+"/check-in/start",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-checkin-cooldown-a-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"lat": 55.751244,
			"lng": 37.618423,
		},
	)
	if firstRec.Code != http.StatusOK {
		t.Fatalf("first check-in expected 200, got %d, body=%s", firstRec.Code, firstRec.Body.String())
	}

	secondRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/cafes/"+cafeB+"/check-in/start",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-checkin-cooldown-b-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"lat": 55.751244,
			"lng": 37.618423,
		},
	)
	if secondRec.Code != http.StatusTooManyRequests {
		t.Fatalf("second check-in expected 429, got %d, body=%s", secondRec.Code, secondRec.Body.String())
	}
}

func TestCheckInAdminBypassRestrictions(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	adminID := mustCreateTestUser(t, pool, "admin")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, adminID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  adminID,
			"X-Test-Role":     "admin",
			"Idempotency-Key": fmt.Sprintf("it-checkin-admin-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     5,
			"drink_id":   "espresso",
			"taste_tags": []string{"sweet"},
			"summary":    "Проверка админского bypass для визита: далеко от точки кофейни и без ожидания dwell.",
			"photos":     []string{},
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}
	var createResp struct {
		ReviewID string `json:"review_id"`
	}
	if err := json.Unmarshal(createRec.Body.Bytes(), &createResp); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	startRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/cafes/"+cafeID+"/check-in/start",
		map[string]string{
			"X-Test-User-ID":  adminID,
			"X-Test-Role":     "admin",
			"Idempotency-Key": fmt.Sprintf("it-checkin-admin-start-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"lat": 0.0,
			"lng": 0.0,
		},
	)
	if startRec.Code != http.StatusOK {
		t.Fatalf("admin check-in start expected 200, got %d, body=%s", startRec.Code, startRec.Body.String())
	}
	var startResp struct {
		CheckInID string `json:"checkin_id"`
	}
	if err := json.Unmarshal(startRec.Body.Bytes(), &startResp); err != nil {
		t.Fatalf("decode admin check-in start response: %v", err)
	}
	if strings.TrimSpace(startResp.CheckInID) == "" {
		t.Fatalf("empty checkin_id in response: %s", startRec.Body.String())
	}

	verifyRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews/"+createResp.ReviewID+"/visit/verify",
		map[string]string{
			"X-Test-User-ID":  adminID,
			"X-Test-Role":     "admin",
			"Idempotency-Key": fmt.Sprintf("it-checkin-admin-verify-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"checkin_id": startResp.CheckInID,
			"lat":        0.0,
			"lng":        0.0,
		},
	)
	if verifyRec.Code != http.StatusOK {
		t.Fatalf("admin verify visit expected 200, got %d, body=%s", verifyRec.Code, verifyRec.Body.String())
	}
	var verifyResp struct {
		Confidence string `json:"confidence"`
	}
	if err := json.Unmarshal(verifyRec.Body.Bytes(), &verifyResp); err != nil {
		t.Fatalf("decode admin verify response: %v", err)
	}
	if strings.TrimSpace(verifyResp.Confidence) == "" || verifyResp.Confidence == "none" {
		t.Fatalf("expected non-empty confidence for admin bypass flow, got %q", verifyResp.Confidence)
	}
}

func TestAdminCafeRatingDiagnosticsAccessAndPayload(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	adminID := mustCreateTestUser(t, pool, "admin")
	userID := mustCreateTestUser(t, pool, "user")
	cafeID := mustCreateTestCafe(t, pool)
	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, adminID)
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestCafe(t, pool, cafeID)
	})

	createRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/reviews",
		map[string]string{
			"X-Test-User-ID":  userID,
			"X-Test-Role":     "user",
			"Idempotency-Key": fmt.Sprintf("it-rating-diag-create-%d", time.Now().UnixNano()),
		},
		map[string]interface{}{
			"cafe_id":    cafeID,
			"rating":     5,
			"drink_id":   "v60",
			"taste_tags": []string{"berry", "floral"},
			"summary":    "Очень чистая чашка с ягодной кислотностью, насыщенным ароматом и длинным сладким послевкусием. Удобная посадка и хороший сервис.",
		},
	)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create review expected 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	forbiddenRec := performJSONRequest(
		t,
		router,
		http.MethodGet,
		"/api/admin/cafes/"+cafeID+"/rating-diagnostics",
		map[string]string{
			"X-Test-User-ID": userID,
			"X-Test-Role":    "user",
		},
		nil,
	)
	if forbiddenRec.Code != http.StatusForbidden {
		t.Fatalf("non-admin diagnostics expected 403, got %d, body=%s", forbiddenRec.Code, forbiddenRec.Body.String())
	}

	adminRec := performJSONRequest(
		t,
		router,
		http.MethodGet,
		"/api/admin/cafes/"+cafeID+"/rating-diagnostics",
		map[string]string{
			"X-Test-User-ID": adminID,
			"X-Test-Role":    "admin",
		},
		nil,
	)
	if adminRec.Code != http.StatusOK {
		t.Fatalf("admin diagnostics expected 200, got %d, body=%s", adminRec.Code, adminRec.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(adminRec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode diagnostics response: %v", err)
	}
	if gotCafeID := strings.TrimSpace(fmt.Sprintf("%v", body["cafe_id"])); gotCafeID != cafeID {
		t.Fatalf("unexpected cafe_id in diagnostics: got=%q expected=%q", gotCafeID, cafeID)
	}
	if valueFloat(body["derived_rating"]) <= 0 {
		t.Fatalf("expected positive derived_rating, got %v", body["derived_rating"])
	}
	reviews, ok := body["reviews"].([]interface{})
	if !ok || len(reviews) == 0 {
		t.Fatalf("expected non-empty reviews diagnostics payload, got %v", body["reviews"])
	}
}
