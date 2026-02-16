package reviews

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Service) resolveDrinkInputTx(
	ctx context.Context,
	tx pgx.Tx,
	rawDrinkID string,
	rawDrink string,
	userID string,
) (resolvedDrink, error) {
	drinkID := normalizeDrinkToken(rawDrinkID)
	drinkName := normalizeDrinkText(rawDrink)

	if drinkID != "" {
		id, name, found, err := s.lookupDrinkByIDTx(ctx, tx, drinkID)
		if err != nil {
			return resolvedDrink{}, err
		}
		if found {
			return resolvedDrink{ID: id, Name: name}, nil
		}
	}

	if drinkName != "" {
		id, name, found, err := s.lookupDrinkByAliasTx(ctx, tx, drinkName)
		if err != nil {
			return resolvedDrink{}, err
		}
		if found {
			return resolvedDrink{ID: id, Name: name}, nil
		}
	}

	candidate := drinkName
	if candidate == "" {
		candidate = normalizeDrinkText(rawDrinkID)
	}
	if candidate == "" {
		return resolvedDrink{}, ErrInvalidDrink
	}

	// Unknown drinks are stored as free-form lowercase text so admins can map
	// them later; canonical drink_id stays empty until mapping happens.
	if err := s.registerUnknownDrinkFormatTx(ctx, tx, candidate, userID); err != nil {
		return resolvedDrink{}, err
	}
	return resolvedDrink{ID: "", Name: candidate}, nil
}

func (s *Service) lookupDrinkByIDTx(
	ctx context.Context,
	tx pgx.Tx,
	drinkID string,
) (string, string, bool, error) {
	var (
		id   string
		name string
	)
	err := tx.QueryRow(ctx, sqlSelectDrinkByID, drinkID).Scan(&id, &name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	return normalizeDrinkToken(id), normalizeDrinkText(name), true, nil
}

func (s *Service) lookupDrinkByAliasTx(
	ctx context.Context,
	tx pgx.Tx,
	drink string,
) (string, string, bool, error) {
	var (
		id   string
		name string
	)
	err := tx.QueryRow(ctx, sqlSelectDrinkByAlias, drink).Scan(&id, &name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	return normalizeDrinkToken(id), normalizeDrinkText(name), true, nil
}

func (s *Service) registerUnknownDrinkFormatTx(
	ctx context.Context,
	tx pgx.Tx,
	drink string,
	userID string,
) error {
	if strings.TrimSpace(drink) == "" {
		return nil
	}
	normalizedDrink := normalizeDrinkText(drink)
	trimmedUserID := strings.TrimSpace(userID)
	if trimmedUserID != "" {
		_, err := tx.Exec(ctx, sqlUpsertUnknownDrinkFormat, normalizedDrink, trimmedUserID)
		return err
	}
	_, err := tx.Exec(ctx, sqlUpsertUnknownDrinkFormat, normalizedDrink, nil)
	return err
}
