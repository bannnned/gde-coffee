package auth

import (
	"context"
	"strings"
)

func updateUserAvatarIfEmpty(ctx context.Context, execer execer, userID string, avatarURL *string) error {
	if avatarURL == nil {
		return nil
	}
	value := strings.TrimSpace(*avatarURL)
	if value == "" || strings.TrimSpace(userID) == "" {
		return nil
	}
	_, err := execer.Exec(
		ctx,
		`update users
		    set avatar_url = $2
		  where id = $1
		    and (avatar_url is null or avatar_url = '')`,
		userID,
		value,
	)
	return err
}
