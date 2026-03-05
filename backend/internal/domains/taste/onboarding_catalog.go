package taste

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
)

const (
	TasteContractVersion   = "taste_map_v1"
	TasteOnboardingVersion = "onboarding_v1"
)

//go:embed contracts/taste_onboarding_v1.json
var onboardingFS embed.FS

type onboardingSpec struct {
	ContractVersion      string           `json:"contract_version"`
	OnboardingVersion    string           `json:"onboarding_version"`
	Locale               string           `json:"locale"`
	EstimatedDurationSec int              `json:"estimated_duration_sec"`
	Steps                []onboardingStep `json:"steps"`
}

type onboardingStep struct {
	ID         string               `json:"id"`
	Type       string               `json:"type"`
	Required   bool                 `json:"required"`
	MinChoices int                  `json:"min_choices"`
	MaxChoices int                  `json:"max_choices"`
	Options    []onboardingOption   `json:"options"`
	Dimensions []onboardingDimension `json:"dimensions"`
	Pairs      []onboardingPair     `json:"pairs"`
}

type onboardingOption struct {
	ID      string      `json:"id"`
	Label   string      `json:"label"`
	Signals []tasteSignal `json:"signals"`
}

type onboardingDimension struct {
	ID      string                  `json:"id"`
	Label   string                  `json:"label"`
	Min     int                     `json:"min"`
	Max     int                     `json:"max"`
	Mapping []onboardingRangeMapping `json:"mapping"`
}

type onboardingRangeMapping struct {
	When    string       `json:"when"`
	Signals []tasteSignal `json:"signals"`
}

type onboardingPair struct {
	ID    string              `json:"id"`
	Left  onboardingPairSide `json:"left"`
	Right onboardingPairSide `json:"right"`
}

type onboardingPairSide struct {
	Label   string       `json:"label"`
	Signals []tasteSignal `json:"signals"`
}

type tasteSignal struct {
	TasteCode string  `json:"taste_code"`
	Polarity  string  `json:"polarity"`
	Strength  float64 `json:"strength"`
}

func loadOnboardingSpec() (onboardingSpec, error) {
	payload, err := onboardingFS.ReadFile("contracts/taste_onboarding_v1.json")
	if err != nil {
		return onboardingSpec{}, fmt.Errorf("read onboarding contract: %w", err)
	}
	var spec onboardingSpec
	if err := json.Unmarshal(payload, &spec); err != nil {
		return onboardingSpec{}, fmt.Errorf("decode onboarding contract: %w", err)
	}
	if strings.TrimSpace(spec.OnboardingVersion) == "" {
		return onboardingSpec{}, fmt.Errorf("onboarding version is empty")
	}
	if len(spec.Steps) == 0 {
		return onboardingSpec{}, fmt.Errorf("onboarding steps are empty")
	}
	return spec, nil
}
