package moderation

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
	handler := NewHandler(pool, nil, config.MediaConfig{})

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

	// Public submission endpoint for users.
	router.POST("/api/moderation/submissions/cafe-create", handler.SubmitCafeCreate)

	// Moderation endpoints for admin/moderator only.
	moderation := router.Group("/api/moderation/submissions")
	moderation.Use(testRequireRoles("admin", "moderator"))
	moderation.POST("/:id/approve", handler.Approve)
	moderation.POST("/:id/reject", handler.Reject)
	moderation.GET("/:id", handler.GetModerationItem)

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

	email := fmt.Sprintf("moderation-it-%d@example.com", time.Now().UnixNano())
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

func mustDeleteTestUser(t *testing.T, pool *pgxpool.Pool, userID string) {
	t.Helper()
	if strings.TrimSpace(userID) == "" {
		return
	}
	mustExec(t, pool, `delete from users where id = $1::uuid`, userID)
}

func mustExec(t *testing.T, pool *pgxpool.Pool, query string, args ...interface{}) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := pool.Exec(ctx, query, args...); err != nil {
		t.Fatalf("exec query failed: %v", err)
	}
}

func mustCreateCafeCreateSubmission(
	t *testing.T,
	pool *pgxpool.Pool,
	authorUserID string,
	name string,
	address string,
) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	payload := map[string]interface{}{
		"name":                   name,
		"address":                address,
		"description":            "integration cafe create submission",
		"latitude":               55.751244,
		"longitude":              37.618423,
		"amenities":              []string{"wifi", "outlets"},
		"photo_object_keys":      []string{},
		"menu_photo_object_keys": []string{},
	}
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal submission payload: %v", err)
	}

	var submissionID string
	err = pool.QueryRow(
		ctx,
		`insert into moderation_submissions (author_user_id, entity_type, action_type, payload)
		 values ($1::uuid, 'cafe', 'create', $2::jsonb)
		 returning id::text`,
		authorUserID,
		rawPayload,
	).Scan(&submissionID)
	if err != nil {
		t.Fatalf("insert moderation submission: %v", err)
	}
	return submissionID
}

func mustDeleteCafeByNameAddress(t *testing.T, pool *pgxpool.Pool, name string, address string) {
	t.Helper()
	mustExec(
		t,
		pool,
		`delete from cafes where name = $1 and address = $2`,
		name,
		address,
	)
}

func TestModerationApproveCafeCreateSubmission(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	authorID := mustCreateTestUser(t, pool, "user")
	moderatorID := mustCreateTestUser(t, pool, "moderator")
	cafeName := fmt.Sprintf("mod-it-cafe-%d", time.Now().UnixNano())
	cafeAddress := fmt.Sprintf("mod-it-addr-%d", time.Now().UnixNano())
	submissionID := mustCreateCafeCreateSubmission(t, pool, authorID, cafeName, cafeAddress)

	t.Cleanup(func() {
		mustExec(
			t,
			pool,
			`delete from reputation_events
			  where source_type = 'moderation_submission'
			    and source_id = $1`,
			submissionID,
		)
		mustExec(t, pool, `delete from moderation_submissions where id = $1::uuid`, submissionID)
		mustDeleteCafeByNameAddress(t, pool, cafeName, cafeAddress)
		mustDeleteTestUser(t, pool, moderatorID)
		mustDeleteTestUser(t, pool, authorID)
	})

	approveRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/moderation/submissions/"+submissionID+"/approve",
		map[string]string{
			"X-Test-User-ID": moderatorID,
			"X-Test-Role":    "moderator",
		},
		nil,
	)
	if approveRec.Code != http.StatusOK {
		t.Fatalf("approve expected 200, got %d, body=%s", approveRec.Code, approveRec.Body.String())
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var (
		status      string
		dbModerator string
		decidedAt   *time.Time
	)
	if err := pool.QueryRow(
		ctx,
		`select status, coalesce(moderator_id::text, ''), decided_at
		   from moderation_submissions
		  where id = $1::uuid`,
		submissionID,
	).Scan(&status, &dbModerator, &decidedAt); err != nil {
		t.Fatalf("load submission after approve: %v", err)
	}
	if status != "approved" {
		t.Fatalf("expected submission status=approved, got %q", status)
	}
	if dbModerator != moderatorID {
		t.Fatalf("expected moderator_id=%s, got %s", moderatorID, dbModerator)
	}
	if decidedAt == nil {
		t.Fatalf("expected decided_at to be set")
	}

	var cafesCount int
	if err := pool.QueryRow(
		ctx,
		`select count(*)::int
		   from cafes
		  where name = $1 and address = $2`,
		cafeName,
		cafeAddress,
	).Scan(&cafesCount); err != nil {
		t.Fatalf("count created cafes: %v", err)
	}
	if cafesCount != 1 {
		t.Fatalf("expected exactly one created cafe, got %d", cafesCount)
	}

	var moderationEventsCount int
	if err := pool.QueryRow(
		ctx,
		`select count(*)::int
		   from moderation_events
		  where submission_id = $1::uuid
		    and event_type = 'approved'`,
		submissionID,
	).Scan(&moderationEventsCount); err != nil {
		t.Fatalf("count moderation events: %v", err)
	}
	if moderationEventsCount != 1 {
		t.Fatalf("expected one moderation approved event, got %d", moderationEventsCount)
	}

	var (
		eventType  string
		points     int
		sourceType string
	)
	if err := pool.QueryRow(
		ctx,
		`select event_type, points, source_type
		   from reputation_events
		  where user_id = $1::uuid
		    and source_id = $2
		  order by id desc
		  limit 1`,
		authorID,
		submissionID,
	).Scan(&eventType, &points, &sourceType); err != nil {
		t.Fatalf("load moderation reputation event: %v", err)
	}
	if eventType != "cafe_create_approved" {
		t.Fatalf("expected event_type=cafe_create_approved, got %q", eventType)
	}
	if points != 8 {
		t.Fatalf("expected points=8 for approved cafe create, got %d", points)
	}
	if sourceType != "moderation_submission" {
		t.Fatalf("expected source_type=moderation_submission, got %q", sourceType)
	}
}

func TestModerationApproveRBACMatrix(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	authorID := mustCreateTestUser(t, pool, "user")
	moderatorID := mustCreateTestUser(t, pool, "moderator")
	adminID := mustCreateTestUser(t, pool, "admin")
	userID := mustCreateTestUser(t, pool, "user")
	baristaID := mustCreateTestUser(t, pool, "barista")

	t.Cleanup(func() {
		mustDeleteTestUser(t, pool, baristaID)
		mustDeleteTestUser(t, pool, userID)
		mustDeleteTestUser(t, pool, adminID)
		mustDeleteTestUser(t, pool, moderatorID)
		mustDeleteTestUser(t, pool, authorID)
	})

	cases := []struct {
		name       string
		role       string
		userID     string
		statusCode int
	}{
		{name: "user forbidden", role: "user", userID: userID, statusCode: http.StatusForbidden},
		{name: "barista forbidden", role: "barista", userID: baristaID, statusCode: http.StatusForbidden},
		{name: "moderator allowed", role: "moderator", userID: moderatorID, statusCode: http.StatusOK},
		{name: "admin allowed", role: "admin", userID: adminID, statusCode: http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cafeName := fmt.Sprintf("mod-rbac-cafe-%s-%d", tc.role, time.Now().UnixNano())
			cafeAddress := fmt.Sprintf("mod-rbac-addr-%s-%d", tc.role, time.Now().UnixNano())
			submissionID := mustCreateCafeCreateSubmission(t, pool, authorID, cafeName, cafeAddress)
			t.Cleanup(func() {
				mustExec(
					t,
					pool,
					`delete from reputation_events
					  where source_type = 'moderation_submission'
					    and source_id = $1`,
					submissionID,
				)
				mustExec(t, pool, `delete from moderation_submissions where id = $1::uuid`, submissionID)
				mustDeleteCafeByNameAddress(t, pool, cafeName, cafeAddress)
			})

			rec := performJSONRequest(
				t,
				router,
				http.MethodPost,
				"/api/moderation/submissions/"+submissionID+"/approve",
				map[string]string{
					"X-Test-User-ID": tc.userID,
					"X-Test-Role":    tc.role,
				},
				nil,
			)
			if rec.Code != tc.statusCode {
				t.Fatalf("expected status=%d, got %d, body=%s", tc.statusCode, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestModerationApproveAlreadyProcessedConflict(t *testing.T) {
	pool := integrationTestPool(t)
	router := newIntegrationRouter(pool)

	authorID := mustCreateTestUser(t, pool, "user")
	moderatorID := mustCreateTestUser(t, pool, "moderator")
	cafeName := fmt.Sprintf("mod-conflict-cafe-%d", time.Now().UnixNano())
	cafeAddress := fmt.Sprintf("mod-conflict-addr-%d", time.Now().UnixNano())
	submissionID := mustCreateCafeCreateSubmission(t, pool, authorID, cafeName, cafeAddress)

	t.Cleanup(func() {
		mustExec(
			t,
			pool,
			`delete from reputation_events
			  where source_type = 'moderation_submission'
			    and source_id = $1`,
			submissionID,
		)
		mustExec(t, pool, `delete from moderation_submissions where id = $1::uuid`, submissionID)
		mustDeleteCafeByNameAddress(t, pool, cafeName, cafeAddress)
		mustDeleteTestUser(t, pool, moderatorID)
		mustDeleteTestUser(t, pool, authorID)
	})

	firstRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/moderation/submissions/"+submissionID+"/approve",
		map[string]string{
			"X-Test-User-ID": moderatorID,
			"X-Test-Role":    "moderator",
		},
		nil,
	)
	if firstRec.Code != http.StatusOK {
		t.Fatalf("first approve expected 200, got %d, body=%s", firstRec.Code, firstRec.Body.String())
	}

	secondRec := performJSONRequest(
		t,
		router,
		http.MethodPost,
		"/api/moderation/submissions/"+submissionID+"/approve",
		map[string]string{
			"X-Test-User-ID": moderatorID,
			"X-Test-Role":    "moderator",
		},
		nil,
	)
	if secondRec.Code != http.StatusConflict {
		t.Fatalf("second approve expected 409, got %d, body=%s", secondRec.Code, secondRec.Body.String())
	}

	var apiErr struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(secondRec.Body.Bytes(), &apiErr); err != nil {
		t.Fatalf("decode conflict response: %v", err)
	}
	if apiErr.Code != "conflict" {
		t.Fatalf("expected conflict code, got %q", apiErr.Code)
	}
}
