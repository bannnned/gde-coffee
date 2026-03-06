package cafes

import (
	"math"
	"sort"
	"strings"

	"backend/internal/model"
)

const (
	tasteRankingBoostPositions = 2.4
	tasteSignalWeightMin       = 0.08
	tastePositiveThreshold     = 0.12
	tasteNegativeThreshold     = -0.12
)

type tasteDescriptor struct {
	Label  string
	Tokens []string
}

type tasteMatchResult struct {
	Score          float64
	PositiveLabels []string
	NegativeLabels []string
}

type rankedCafeItem struct {
	Item      model.CafeResponse
	BaseIndex int
	SortScore float64
}

var tasteDescriptors = map[string]tasteDescriptor{
	"fruity_berry": {
		Label:  "ягодные и фруктовые ноты",
		Tokens: []string{"berry", "berries", "fruit", "fruity", "ягод", "фрукт", "джем", "jam"},
	},
	"citrus": {
		Label:  "цитрусовые ноты",
		Tokens: []string{"citrus", "lemon", "orange", "grapefruit", "цитрус", "лимон", "апельсин", "грейпфрут"},
	},
	"floral": {
		Label:  "цветочные ноты",
		Tokens: []string{"floral", "flower", "jasmine", "цветоч", "жасмин"},
	},
	"nutty_cocoa": {
		Label:  "орехово-шоколадный профиль",
		Tokens: []string{"nut", "hazelnut", "almond", "cocoa", "chocolate", "орех", "фундук", "миндаль", "какао", "шоколад"},
	},
	"caramel_sweet": {
		Label:  "карамельно-сладкий профиль",
		Tokens: []string{"caramel", "toffee", "sweet", "sugar", "карамел", "ирис", "слад", "сахар"},
	},
	"spicy": {
		Label:  "пряные ноты",
		Tokens: []string{"spice", "spicy", "cinnamon", "pepper", "прян", "кориц", "спец"},
	},
	"roasted_bitter": {
		Label:  "обжарочно-горький профиль",
		Tokens: []string{"roast", "roasted", "bitter", "dark", "горьк", "обжар", "темн"},
	},
	"herbal_green": {
		Label:  "травянистые ноты",
		Tokens: []string{"herbal", "green", "tea", "grassy", "трав", "зел", "чай"},
	},
	"acidity_high": {
		Label:  "яркая кислотность",
		Tokens: []string{"acid", "acidity", "bright", "кисл"},
	},
	"acidity_low": {
		Label:  "мягкая кислотность",
		Tokens: []string{"low acid", "smooth", "низк кислот", "мягк кислот"},
	},
	"sweetness_high": {
		Label:  "высокая сладость",
		Tokens: []string{"sweet", "слад"},
	},
	"bitterness_high": {
		Label:  "выраженная горечь",
		Tokens: []string{"bitter", "горьк"},
	},
	"body_light": {
		Label:  "легкое тело",
		Tokens: []string{"light body", "tea like", "легк тело", "чайн"},
	},
	"body_heavy": {
		Label:  "плотное тело",
		Tokens: []string{"heavy body", "syrupy", "плотн", "сироп"},
	},
	"aftertaste_long": {
		Label:  "долгое послевкусие",
		Tokens: []string{"long finish", "long aftertaste", "долг послевкус"},
	},
	"aftertaste_short": {
		Label:  "короткое послевкусие",
		Tokens: []string{"short finish", "коротк послевкус"},
	},
	"espresso": {
		Label:  "эспрессо-фокус",
		Tokens: []string{"espresso", "эспрессо"},
	},
	"milk_based": {
		Label:  "молочные напитки",
		Tokens: []string{"latte", "cappuccino", "flat white", "раф", "молоч"},
	},
	"filter": {
		Label:  "фильтр-форматы",
		Tokens: []string{"filter", "v60", "воронк", "аэропресс", "кемекс"},
	},
	"cold": {
		Label:  "холодные напитки",
		Tokens: []string{"cold brew", "iced", "айс", "холодн"},
	},
	"work_focus": {
		Label:  "формат для работы",
		Tokens: []string{"quiet", "laptop", "wifi", "розет", "тихо", "работ"},
	},
	"quick_pickup": {
		Label:  "быстрый формат to-go",
		Tokens: []string{"to go", "takeaway", "быстро", "с собой"},
	},
	"slow_weekend": {
		Label:  "неспешный формат визита",
		Tokens: []string{"brunch", "уют", "терраса", "relax", "неспеш"},
	},
}

func applyTastePersonalization(
	baseItems []model.CafeResponse,
	userSignals []userTasteSignal,
	cafeTasteTokens map[string][]string,
) []model.CafeResponse {
	if len(baseItems) == 0 || len(userSignals) == 0 {
		return baseItems
	}

	ranked := make([]rankedCafeItem, 0, len(baseItems))
	for index, item := range baseItems {
		match := calculateTasteMatch(cafeTasteTokens[strings.TrimSpace(item.ID)], userSignals)
		item.Explainability = buildTasteExplainability(match)
		sortScore := float64(index) - clampFloat(match.Score, -1.2, 1.2)*tasteRankingBoostPositions
		ranked = append(ranked, rankedCafeItem{
			Item:      item,
			BaseIndex: index,
			SortScore: sortScore,
		})
	}

	sort.SliceStable(ranked, func(i, j int) bool {
		if !almostEqual(ranked[i].SortScore, ranked[j].SortScore) {
			return ranked[i].SortScore < ranked[j].SortScore
		}
		return ranked[i].BaseIndex < ranked[j].BaseIndex
	})

	result := make([]model.CafeResponse, 0, len(ranked))
	for _, item := range ranked {
		result = append(result, item.Item)
	}
	return result
}

func calculateTasteMatch(tokens []string, signals []userTasteSignal) tasteMatchResult {
	if len(tokens) == 0 || len(signals) == 0 {
		return tasteMatchResult{}
	}
	normalizedTokens := dedupeTasteTokens(tokens)
	if len(normalizedTokens) == 0 {
		return tasteMatchResult{}
	}

	positive := make([]string, 0, 4)
	negative := make([]string, 0, 4)
	score := 0.0

	for _, signal := range signals {
		code := strings.TrimSpace(strings.ToLower(signal.TasteCode))
		descriptor, ok := tasteDescriptors[code]
		if !ok {
			continue
		}
		weight := clampFloat(math.Abs(signal.Score)*signal.Confidence, 0, 1)
		if weight < tasteSignalWeightMin {
			continue
		}
		if !tasteTokensMatch(normalizedTokens, descriptor.Tokens) {
			continue
		}
		switch strings.TrimSpace(strings.ToLower(signal.Polarity)) {
		case "negative":
			score -= (weight * 0.85)
			negative = appendUniqueLabel(negative, descriptor.Label)
		default:
			score += weight
			positive = appendUniqueLabel(positive, descriptor.Label)
		}
	}

	return tasteMatchResult{
		Score:          clampFloat(score, -1.25, 1.25),
		PositiveLabels: positive,
		NegativeLabels: negative,
	}
}

func buildTasteExplainability(match tasteMatchResult) *string {
	positive := joinTasteLabels(match.PositiveLabels, 2)
	negative := joinTasteLabels(match.NegativeLabels, 2)
	if positive == "" && negative == "" {
		return nil
	}

	var text string
	switch {
	case match.Score >= tastePositiveThreshold && positive != "":
		text = "Под ваш вкус: " + positive + "."
		if negative != "" {
			text += " Слабее по: " + negative + "."
		}
	case match.Score <= tasteNegativeThreshold && negative != "":
		text = "Меньше совпадений с вашим вкусом: " + negative + "."
	case positive != "":
		text = "Частичное совпадение по вкусу: " + positive + "."
	default:
		text = "Совпадение по вкусу ограничено: " + negative + "."
	}

	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	return &text
}

func tasteTokensMatch(tokens []string, rawNeedles []string) bool {
	if len(tokens) == 0 || len(rawNeedles) == 0 {
		return false
	}
	needles := dedupeTasteTokens(rawNeedles)
	if len(needles) == 0 {
		return false
	}
	for _, token := range tokens {
		for _, needle := range needles {
			if token == needle || strings.Contains(token, needle) || strings.Contains(needle, token) {
				return true
			}
		}
	}
	return false
}

func appendUniqueLabel(labels []string, label string) []string {
	normalized := normalizeTasteToken(label)
	if normalized == "" {
		return labels
	}
	for _, existing := range labels {
		if normalizeTasteToken(existing) == normalized {
			return labels
		}
	}
	return append(labels, strings.TrimSpace(label))
}

func joinTasteLabels(labels []string, limit int) string {
	if len(labels) == 0 {
		return ""
	}
	if limit <= 0 || limit > len(labels) {
		limit = len(labels)
	}
	return strings.Join(labels[:limit], ", ")
}

func dedupeTasteTokens(raw []string) []string {
	if len(raw) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{}, len(raw))
	result := make([]string, 0, len(raw))
	for _, item := range raw {
		token := normalizeTasteToken(item)
		if token == "" {
			continue
		}
		if _, ok := seen[token]; ok {
			continue
		}
		seen[token] = struct{}{}
		result = append(result, token)
	}
	return result
}

func normalizeTasteToken(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return ""
	}
	return strings.Join(strings.Fields(trimmed), " ")
}

func clampFloat(value float64, minValue float64, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func almostEqual(left float64, right float64) bool {
	return math.Abs(left-right) <= 0.0000001
}
