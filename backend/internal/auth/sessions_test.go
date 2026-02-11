package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type fakeRow struct {
	val int
	err error
}

func (r fakeRow) Scan(dest ...interface{}) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != 1 {
		return fmt.Errorf("expected 1 dest, got %d", len(dest))
	}
	ptr, ok := dest[0].(*int)
	if !ok {
		return fmt.Errorf("expected *int dest")
	}
	*ptr = r.val
	return nil
}

type fakeSessionExecer struct {
	sessionVersion int
	lastSQL        string
	lastArgs       []interface{}
}

func (f *fakeSessionExecer) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	f.lastSQL = sql
	return fakeRow{val: f.sessionVersion}
}

func (f *fakeSessionExecer) Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error) {
	f.lastSQL = sql
	f.lastArgs = args
	return pgconn.CommandTag{}, nil
}

func TestCreateSession_UsesSessionVersion(t *testing.T) {
	fake := &fakeSessionExecer{sessionVersion: 7}

	_, _, err := createSession(context.Background(), fake, "user-1", "1.2.3.4", "ua")
	if err != nil {
		t.Fatalf("createSession failed: %v", err)
	}
	if len(fake.lastArgs) != 6 {
		t.Fatalf("expected 6 args, got %d", len(fake.lastArgs))
	}
	if v, ok := fake.lastArgs[5].(int); !ok || v != 7 {
		t.Fatalf("expected session_version 7, got %#v", fake.lastArgs[5])
	}
	if !strings.Contains(fake.lastSQL, "user_session_version") {
		t.Fatalf("expected insert to include user_session_version")
	}
}

type captureQueryer struct {
	sql string
}

func (c *captureQueryer) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	c.sql = sql
	return fakeRow{err: pgx.ErrNoRows}
}

func (c *captureQueryer) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return nil, errors.New("not used")
}

func TestGetUserBySession_VersionCheck(t *testing.T) {
	cq := &captureQueryer{}
	_, _, err := getUserBySession(context.Background(), cq, "sid")
	if err == nil {
		t.Fatalf("expected error")
	}
	if !errors.Is(err, errUnauthorized) {
		t.Fatalf("expected unauthorized error, got %v", err)
	}
	if !strings.Contains(cq.sql, "user_session_version") {
		t.Fatalf("expected query to check session_version")
	}
}
