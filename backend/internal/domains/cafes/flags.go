package cafes

import (
	"os"
	"strings"
)

func TasteMapRankingEnabledFromEnv() bool {
	return envBool("TASTE_MAP_RANKING_V1_ENABLED", false)
}

func envBool(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	switch raw {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}
