package taste

import (
	"os"
	"strconv"
	"strings"
)

func TasteMapEnabledFromEnv() bool {
	return envBool("TASTE_MAP_V1_ENABLED", false)
}

func TasteInferenceEnabledFromEnv() bool {
	return envBool("TASTE_INFERENCE_V1_ENABLED", false)
}

func TasteInferenceNightlyHourUTCFromEnv() int {
	return envInt("TASTE_INFERENCE_NIGHTLY_HOUR_UTC", 3, 0, 23)
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

func envInt(key string, fallback int, min int, max int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	if value < min || value > max {
		return fallback
	}
	return value
}
