package reviews

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) RunIdempotent(
	ctx context.Context,
	scope string,
	idempotencyKey string,
	requestHash string,
	execute func(tx pgx.Tx) (int, map[string]interface{}, error),
) (idempotentResult, error) {
	if scope == "" || idempotencyKey == "" {
		return idempotentResult{}, fmt.Errorf("scope and idempotency key are required")
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return idempotentResult{}, err
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	insertTag, err := tx.Exec(
		ctx,
		`insert into idempotency_keys (scope, idempotency_key, request_hash, response_status, response_body)
		 values ($1, $2, $3, 0, '{}'::jsonb)
		 on conflict (scope, idempotency_key) do nothing`,
		scope,
		idempotencyKey,
		requestHash,
	)
	if err != nil {
		return idempotentResult{}, err
	}

	if insertTag.RowsAffected() == 0 {
		var existingHash string
		var responseStatus int
		var responseBodyRaw []byte
		err = tx.QueryRow(
			ctx,
			`select request_hash, response_status, response_body
			   from idempotency_keys
			  where scope = $1 and idempotency_key = $2
			  for update`,
			scope,
			idempotencyKey,
		).Scan(&existingHash, &responseStatus, &responseBodyRaw)
		if err != nil {
			return idempotentResult{}, err
		}

		if existingHash != requestHash {
			return idempotentResult{}, ErrIdempotencyConflict
		}
		if responseStatus <= 0 {
			return idempotentResult{}, ErrIdempotencyInProgress
		}

		replayedBody := make(map[string]interface{})
		if len(responseBodyRaw) > 0 {
			if err := json.Unmarshal(responseBodyRaw, &replayedBody); err != nil {
				return idempotentResult{}, err
			}
		}

		if err := tx.Commit(ctx); err != nil {
			return idempotentResult{}, err
		}
		return idempotentResult{StatusCode: responseStatus, Body: replayedBody, Replay: true}, nil
	}

	statusCode, responseBody, err := execute(tx)
	if err != nil {
		return idempotentResult{}, err
	}

	bodyJSON, err := json.Marshal(responseBody)
	if err != nil {
		return idempotentResult{}, err
	}

	if _, err := tx.Exec(
		ctx,
		`update idempotency_keys
		    set response_status = $3,
		        response_body = $4::jsonb
		  where scope = $1 and idempotency_key = $2`,
		scope,
		idempotencyKey,
		statusCode,
		bodyJSON,
	); err != nil {
		return idempotentResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return idempotentResult{}, err
	}

	return idempotentResult{StatusCode: statusCode, Body: responseBody, Replay: false}, nil
}
