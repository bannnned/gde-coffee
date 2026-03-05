# Taste Map v1 - Contract

> Single source of truth для Step 1: taxonomy, onboarding contract, API DTO draft, versioning/flags.

## 0. Metadata

| Field | Value |
|---|---|
| Contract ID | `taste_map_v1` |
| Inference version | `taste_inference_v1` |
| Date | `2026-03-05` |
| Owner | Product + Backend + Frontend |
| Locale | `ru-RU` |
| Scope | docs/spec only (no runtime changes) |

## 1. Related source files

- `/Users/a1/Desktop/Prog/gde-coffee/docs/taste_taxonomy_v1.json`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/taste_onboarding_v1.json`

JSON-файлы считаются машиночитаемым каноническим слоем для следующих шагов (DB seed, API, frontend onboarding).

## 2. Feature flags and versioning

### 2.1 Feature flags

- `taste_map_v1`
  - включает onboarding и профиль вкуса.
- `taste_inference_v1`
  - включает пересчет taste profile из пользовательских сигналов.
- `taste_map_ranking_v1`
  - включает персонализацию выдачи по taste profile.

### 2.2 Version fields (обязательны в payload/логах)

- `taste_contract_version = "taste_map_v1"`
- `taste_taxonomy_version = "2026-03-05"`
- `taste_onboarding_version = "onboarding_v1"`
- `taste_inference_version = "taste_inference_v1"`

## 3. Taxonomy v1

Таксономия разделяет descriptive и affective слой.

- Descriptive: flavor/structure/preference/context (что и как пользователь обычно потребляет/ощущает).
- Affective: polarity `positive|negative` для вкусовых семейств и структуры.

### 3.1 Groups

- `flavor_family`
- `structure`
- `brew_preference`
- `milk_preference`
- `serving`
- `context`

### 3.2 Polarity rules

- `flavor_family`, `structure`: разрешены `positive` и `negative`.
- `brew_preference`, `milk_preference`, `serving`, `context`: только `positive`.

### 3.3 Tags in v1

Полный список кодов в `/Users/a1/Desktop/Prog/gde-coffee/docs/taste_taxonomy_v1.json`.

Минимальный обязательный набор для UI/алгоритма:

- flavor family:
  - `fruity_berry`, `citrus`, `floral`, `nutty_cocoa`, `caramel_sweet`, `spicy`, `roasted_bitter`, `herbal_green`
- structure:
  - `acidity_high`, `acidity_low`, `sweetness_high`, `bitterness_high`, `body_light`, `body_heavy`, `aftertaste_long`, `aftertaste_short`
- preference/context:
  - `espresso`, `milk_based`, `filter`, `cold`, `black_only`, `milk_ok`, `plant_milk_preferred`, `hot`, `iced`, `quick_pickup`, `work_focus`, `slow_weekend`

## 4. Onboarding questions v1

Канон вопросов и signal mapping хранится в:

- `/Users/a1/Desktop/Prog/gde-coffee/docs/taste_onboarding_v1.json`

### 4.1 UX constraints

- Длительность: 45-60 секунд.
- Количество шагов: 8.
- Progress обязателен.
- На любом шаге доступен skip.

### 4.2 Question types used

- `single_choice`
- `multi_choice`
- `range`
- `paired_preference`

### 4.3 Mapping rule

Каждый ответ дает `signals[]`:

```text
signal = {
  taste_code,
  polarity,
  strength (0..1),
  source: onboarding
}
```

Инициализация профиля после onboarding:

```text
baseline_score(tag) = average(strength per tag with polarity sign)
baseline_confidence(tag) = min(0.65, 0.35 + 0.05 * signal_count_for_tag)
```

## 5. API DTO draft

> DTO draft фиксирует контракт для следующих шагов; точные HTTP-коды будут финализированы на реализации.

## 5.1 GET `/v1/taste/onboarding`

### Response 200

```json
{
  "contract_version": "taste_map_v1",
  "onboarding_version": "onboarding_v1",
  "locale": "ru-RU",
  "estimated_duration_sec": 55,
  "steps": [
    {
      "id": "drink_format",
      "type": "single_choice",
      "title": "Что вы чаще пьете?",
      "options": []
    }
  ]
}
```

## 5.2 POST `/v1/taste/onboarding/complete`

### Request

```json
{
  "onboarding_version": "onboarding_v1",
  "session_id": "uuid",
  "answers": [
    {
      "question_id": "drink_format",
      "value": "filter"
    }
  ],
  "client_completed_at": "2026-03-05T12:00:00Z"
}
```

### Response 200

```json
{
  "contract_version": "taste_map_v1",
  "inference_version": "taste_inference_v1",
  "profile": {
    "tags": [
      {
        "taste_code": "filter",
        "polarity": "positive",
        "score": 0.74,
        "confidence": 0.5,
        "source": "onboarding"
      }
    ],
    "updated_at": "2026-03-05T12:00:01Z"
  }
}
```

## 5.3 GET `/v1/me/taste-map`

### Response 200

```json
{
  "contract_version": "taste_map_v1",
  "inference_version": "taste_inference_v1",
  "base_map": {
    "onboarding_version": "onboarding_v1",
    "completed_at": "2026-03-05T12:00:00Z"
  },
  "active_tags": [
    {
      "taste_code": "nutty_cocoa",
      "polarity": "positive",
      "score": 0.62,
      "confidence": 0.67,
      "source": "mixed"
    }
  ],
  "hypotheses": [
    {
      "id": "uuid",
      "taste_code": "fruity_berry",
      "polarity": "negative",
      "score": -0.41,
      "confidence": 0.58,
      "status": "new",
      "reason": "основано на 6 отзывах за 30 дней"
    }
  ],
  "updated_at": "2026-03-05T12:30:00Z"
}
```

## 5.4 POST `/v1/me/taste-hypotheses/:id/accept`

### Request

```json
{
  "feedback_source": "profile_screen"
}
```

### Response 200

```json
{
  "id": "uuid",
  "status": "accepted",
  "updated_at": "2026-03-05T12:35:00Z"
}
```

## 5.5 POST `/v1/me/taste-hypotheses/:id/dismiss`

### Request

```json
{
  "feedback_source": "profile_screen",
  "reason_code": "not_me"
}
```

### Response 200

```json
{
  "id": "uuid",
  "status": "dismissed",
  "cooldown_until": "2026-04-04T12:35:00Z",
  "updated_at": "2026-03-05T12:35:00Z"
}
```

## 5.6 Error payload (for all endpoints)

```json
{
  "error": {
    "code": "validation_error",
    "message": "onboarding_version is not supported",
    "details": {
      "field": "onboarding_version"
    }
  }
}
```

## 6. Acceptance criteria for Step 1

- Есть один основной markdown-контракт: этот файл.
- Есть 2 machine-readable спецификации:
  - `/Users/a1/Desktop/Prog/gde-coffee/docs/taste_taxonomy_v1.json`
  - `/Users/a1/Desktop/Prog/gde-coffee/docs/taste_onboarding_v1.json`
- JSON соответствует описанию в контракте.
- Runtime код backend/frontend не менялся.

## 7. Open questions (to resolve before Step 2)

1. Негативные гипотезы запускаем сразу в v1 или флагуем как `v1.1`?
2. Добавляем ли `fermented_funky` в v1 taxonomy или оставляем как будущий тег?
3. Для paired-preference в onboarding: разрешаем skip без штрафа confidence или даем нейтральный сигнал?
