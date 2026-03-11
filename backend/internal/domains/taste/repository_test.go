package taste

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

type stubQuerier struct {
	queryRowFn func(ctx context.Context, sql string, args ...any) pgx.Row

	calls    int
	lastSQL  string
	lastArgs []any
}

func (s *stubQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	s.calls++
	s.lastSQL = sql
	s.lastArgs = append([]any(nil), args...)
	if s.queryRowFn != nil {
		return s.queryRowFn(ctx, sql, args...)
	}
	return stubRow{err: errors.New("unexpected query")}
}

type stubRow struct {
	scanFn func(dest ...any) error
	err    error
}

func (r stubRow) Scan(dest ...any) error {
	if r.scanFn != nil {
		return r.scanFn(dest...)
	}
	return r.err
}

func TestRepositoryCreateOnboardingSession(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	q := &stubQuerier{
		queryRowFn: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return stubRow{
				scanFn: func(dest ...any) error {
					*dest[0].(*string) = "s1"
					*dest[1].(*string) = "u1"
					*dest[2].(*string) = TasteOnboardingVersion
					*dest[3].(*string) = StatusOnboardingStarted
					*dest[4].(*[]byte) = []byte(`{}`)
					*dest[5].(*time.Time) = now
					*dest[6].(**time.Time) = nil
					*dest[7].(*time.Time) = now
					*dest[8].(*time.Time) = now
					return nil
				},
			}
		},
	}
	repo := newRepositoryWithQuerier(q)

	item, err := repo.CreateOnboardingSession(context.Background(), "u1", "")
	if err != nil {
		t.Fatalf("CreateOnboardingSession returned error: %v", err)
	}
	if item.ID != "s1" || item.UserID != "u1" {
		t.Fatalf("unexpected session payload: %+v", item)
	}
	if len(q.lastArgs) != 3 {
		t.Fatalf("expected 3 sql args, got %d", len(q.lastArgs))
	}
	if got := q.lastArgs[1].(string); got != TasteOnboardingVersion {
		t.Fatalf("expected default onboarding version, got %q", got)
	}
	if got := q.lastArgs[2].(string); got != StatusOnboardingStarted {
		t.Fatalf("expected started status, got %q", got)
	}
	if !strings.Contains(strings.ToLower(q.lastSQL), "insert into public.taste_onboarding_sessions") {
		t.Fatalf("unexpected sql: %s", q.lastSQL)
	}
}

func TestRepositoryCompleteOnboardingSession(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	completedAt := now.Add(2 * time.Minute)
	q := &stubQuerier{
		queryRowFn: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return stubRow{
				scanFn: func(dest ...any) error {
					*dest[0].(*string) = "s1"
					*dest[1].(*string) = "u1"
					*dest[2].(*string) = TasteOnboardingVersion
					*dest[3].(*string) = StatusOnboardingCompleted
					*dest[4].(*[]byte) = []byte(`{"ok":true}`)
					*dest[5].(*time.Time) = now
					*dest[6].(**time.Time) = &completedAt
					*dest[7].(*time.Time) = now
					*dest[8].(*time.Time) = completedAt
					return nil
				},
			}
		},
	}
	repo := newRepositoryWithQuerier(q)

	item, err := repo.CompleteOnboardingSession(
		context.Background(),
		"s1",
		"u1",
		json.RawMessage(`{"a":1}`),
		completedAt,
	)
	if err != nil {
		t.Fatalf("CompleteOnboardingSession returned error: %v", err)
	}
	if item.Status != StatusOnboardingCompleted {
		t.Fatalf("expected completed status, got %q", item.Status)
	}
	if item.CompletedAt == nil || !item.CompletedAt.Equal(completedAt) {
		t.Fatalf("expected completed_at to match, got %v", item.CompletedAt)
	}
	if got := q.lastArgs[2].(string); got != StatusOnboardingCompleted {
		t.Fatalf("expected completed status arg, got %q", got)
	}
	if payload := string(q.lastArgs[3].(json.RawMessage)); payload != `{"a":1}` {
		t.Fatalf("unexpected answers payload: %s", payload)
	}
}

func TestRepositoryGetAndUpsertUserTasteProfile(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	activeVersion := "onboarding_v1"
	q := &stubQuerier{
		queryRowFn: func(_ context.Context, sql string, _ ...any) pgx.Row {
			switch {
			case strings.Contains(sql, "insert into public.user_taste_profile"):
				return stubRow{
					scanFn: func(dest ...any) error {
						*dest[0].(*string) = "u1"
						*dest[1].(**string) = &activeVersion
						*dest[2].(*string) = DefaultInferenceVersion
						*dest[3].(**time.Time) = nil
						*dest[4].(**time.Time) = nil
						*dest[5].(*[]byte) = []byte(`{"seed":true}`)
						*dest[6].(*time.Time) = now
						*dest[7].(*time.Time) = now
						return nil
					},
				}
			default:
				return stubRow{
					scanFn: func(dest ...any) error {
						*dest[0].(*string) = "u1"
						*dest[1].(**string) = &activeVersion
						*dest[2].(*string) = DefaultInferenceVersion
						*dest[3].(**time.Time) = nil
						*dest[4].(**time.Time) = nil
						*dest[5].(*[]byte) = []byte(`{"seed":true}`)
						*dest[6].(*time.Time) = now
						*dest[7].(*time.Time) = now
						return nil
					},
				}
			}
		},
	}
	repo := newRepositoryWithQuerier(q)

	upserted, err := repo.UpsertUserTasteProfile(context.Background(), UpsertUserTasteProfileParams{
		UserID:       "u1",
		MetadataJSON: nil,
	})
	if err != nil {
		t.Fatalf("UpsertUserTasteProfile returned error: %v", err)
	}
	if upserted.InferenceVersion != DefaultInferenceVersion {
		t.Fatalf("expected default inference version, got %q", upserted.InferenceVersion)
	}

	got, err := repo.GetUserTasteProfile(context.Background(), "u1")
	if err != nil {
		t.Fatalf("GetUserTasteProfile returned error: %v", err)
	}
	if got.UserID != "u1" {
		t.Fatalf("unexpected profile: %+v", got)
	}
}

func TestRepositoryUpsertUserTasteTag(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	q := &stubQuerier{
		queryRowFn: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return stubRow{
				scanFn: func(dest ...any) error {
					*dest[0].(*string) = "t1"
					*dest[1].(*string) = "u1"
					*dest[2].(*string) = "nutty_cocoa"
					*dest[3].(*string) = PolarityPositive
					*dest[4].(*float64) = 0.7
					*dest[5].(*float64) = 0.5
					*dest[6].(*string) = TagSourceMixed
					*dest[7].(*string) = TagStatusActive
					*dest[8].(**time.Time) = nil
					*dest[9].(*[]byte) = []byte(`{}`)
					*dest[10].(*time.Time) = now
					*dest[11].(*time.Time) = now
					return nil
				},
			}
		},
	}
	repo := newRepositoryWithQuerier(q)

	item, err := repo.UpsertUserTasteTag(context.Background(), UpsertUserTasteTagParams{
		UserID:     "u1",
		TasteCode:  "nutty_cocoa",
		Polarity:   PolarityPositive,
		Score:      0.7,
		Confidence: 0.5,
	})
	if err != nil {
		t.Fatalf("UpsertUserTasteTag returned error: %v", err)
	}
	if item.Source != TagSourceMixed || item.Status != TagStatusActive {
		t.Fatalf("unexpected defaults: source=%q status=%q", item.Source, item.Status)
	}
}

func TestRepositoryCreateAndUpdateTasteHypothesis(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	q := &stubQuerier{
		queryRowFn: func(_ context.Context, sql string, _ ...any) pgx.Row {
			return stubRow{
				scanFn: func(dest ...any) error {
					*dest[0].(*string) = "h1"
					*dest[1].(*string) = "u1"
					*dest[2].(*string) = "fruity_berry"
					*dest[3].(*string) = PolarityNegative
					*dest[4].(*float64) = -0.4
					*dest[5].(*float64) = 0.6
					*dest[6].(*[]byte) = []byte(`{"k":"v"}`)
					if strings.Contains(sql, "update public.taste_hypotheses") {
						*dest[7].(*string) = HypothesisStatusDismissed
						*dest[8].(*int) = 1
					} else {
						*dest[7].(*string) = HypothesisStatusNew
						*dest[8].(*int) = 0
					}
					*dest[9].(**time.Time) = nil
					*dest[10].(*time.Time) = now
					*dest[11].(*time.Time) = now
					return nil
				},
			}
		},
	}
	repo := newRepositoryWithQuerier(q)

	created, err := repo.CreateTasteHypothesis(context.Background(), CreateTasteHypothesisParams{
		UserID:     "u1",
		TasteCode:  "fruity_berry",
		Polarity:   PolarityNegative,
		Score:      -0.4,
		Confidence: 0.6,
	})
	if err != nil {
		t.Fatalf("CreateTasteHypothesis returned error: %v", err)
	}
	if created.Status != HypothesisStatusNew {
		t.Fatalf("expected new status, got %q", created.Status)
	}

	updated, err := repo.UpdateTasteHypothesisStatus(context.Background(), UpdateTasteHypothesisStatusParams{
		ID:           "h1",
		UserID:       "u1",
		Status:       HypothesisStatusDismissed,
		DismissCount: 1,
		ReasonJSON:   json.RawMessage(`{"source":"user"}`),
	})
	if err != nil {
		t.Fatalf("UpdateTasteHypothesisStatus returned error: %v", err)
	}
	if updated.Status != HypothesisStatusDismissed || updated.DismissCount != 1 {
		t.Fatalf("unexpected updated hypothesis: %+v", updated)
	}
}

func TestRepositoryCreateTasteInferenceRun(t *testing.T) {
	now := time.Now().UTC().Round(time.Second)
	errText := "none"
	q := &stubQuerier{
		queryRowFn: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return stubRow{
				scanFn: func(dest ...any) error {
					*dest[0].(*string) = "r1"
					*dest[1].(*string) = "u1"
					*dest[2].(*string) = "onboarding_completed"
					*dest[3].(*string) = DefaultInferenceVersion
					*dest[4].(*[]byte) = []byte(`{"in":1}`)
					*dest[5].(*[]byte) = []byte(`{"out":1}`)
					*dest[6].(*int) = 2
					*dest[7].(*int) = 15
					*dest[8].(*string) = RunStatusOK
					*dest[9].(**string) = &errText
					*dest[10].(*time.Time) = now
					return nil
				},
			}
		},
	}
	repo := newRepositoryWithQuerier(q)

	item, err := repo.CreateTasteInferenceRun(context.Background(), CreateTasteInferenceRunParams{
		UserID:  "u1",
		Trigger: "onboarding_completed",
	})
	if err != nil {
		t.Fatalf("CreateTasteInferenceRun returned error: %v", err)
	}
	if item.Version != DefaultInferenceVersion || item.Status != RunStatusOK {
		t.Fatalf("unexpected run defaults: %+v", item)
	}
	if item.ErrorText == nil || *item.ErrorText != errText {
		t.Fatalf("expected error text pointer to be scanned")
	}
}

func TestRepositoryPropagatesScanErrors(t *testing.T) {
	expected := errors.New("scan failed")
	q := &stubQuerier{
		queryRowFn: func(_ context.Context, _ string, _ ...any) pgx.Row {
			return stubRow{err: expected}
		},
	}
	repo := newRepositoryWithQuerier(q)

	_, err := repo.GetUserTasteProfile(context.Background(), "u1")
	if !errors.Is(err, expected) {
		t.Fatalf("expected %v, got %v", expected, err)
	}
}
