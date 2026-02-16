package reputation

const (
	// TrustedParticipantThreshold controls when a user receives trusted status.
	// The value is part of public v1 rules and should only change via product decision.
	TrustedParticipantThreshold = 120.0
)

func IsTrustedParticipant(score float64) bool {
	return score >= TrustedParticipantThreshold
}

func BadgeFromScore(score float64) string {
	switch {
	case score >= 320:
		return "Эксперт сообщества"
	case score >= 180:
		return "Проверенный участник"
	case score >= TrustedParticipantThreshold:
		return "Надежный участник"
	case score >= 40:
		return "Активный участник"
	default:
		return "Участник"
	}
}
