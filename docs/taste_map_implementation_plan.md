# Taste Map - Implementation Plan (MD)

> Документ для команды разработки: подробный план внедрения персональной "Карты вкусов" в Gde Coffee.

## 1. Цель реализации

Перевести продукт с ручных пользовательских тегов на персональный вкус-профиль, который формируется из:

- стартового onboarding-опроса,
- поведения пользователя в приложении (отзывы, оценки, check-in, полезность),
- обратной связи на предположения системы.

Результат: персонализированная выдача кофеен и прозрачный экран "Карта вкусов" в профиле.

---

## 2. Functional Requirements

1. Onboarding после регистрации:
- показать опрос из 6-10 шагов;
- сохранить ответы как версионную сессию.

2. Автопрофиль пользователя:
- создать первичный `taste profile` из onboarding;
- хранить теги в формате `tag + score + confidence + source`.

3. Поведенческий inference:
- обрабатывать отзывы/оценки и обновлять taste profile;
- добавлять новые теги, если confidence выше порога;
- формировать гипотезы вида "нравится воронка", "не нравится ягодный оттенок".

4. Экран в профиле:
- блок "Базовые предпочтения";
- блок "Наши предположения";
- действия на гипотезах: `Оставить`, `Скрыть`;
- кнопка "Пройти заново" (создает новую версию onboarding).

5. Рекомендательная интеграция:
- discovery/ranking использует `user_taste_tags`;
- на карточке показывается explainability: "подходит вам, потому что ...".

---

## 3. Non-Functional Requirements

- Пересчет профиля идемпотентный.
- Версионирование формулы inference (`taste_inference_v1`).
- Полный аудит изменений профиля.
- P95 API профильной страницы <= 350ms.
- Zero data loss при повторном onboarding.

---

## 4. Data Model (предложение)

### 4.1 Справочник вкусов

`taste_taxonomy`
- `id` (uuid)
- `code` (unique, например `brew_v60`, `note_berry`, `texture_creamy`)
- `group` (`brew_method`, `flavor_note`, `milk_pref`, `bitterness`, ...)
- `display_name`
- `is_negative_allowed` (bool)
- `created_at`, `updated_at`

### 4.2 Сессии onboarding

`taste_onboarding_sessions`
- `id` (uuid)
- `user_id`
- `version` (int)
- `status` (`started`, `completed`, `abandoned`)
- `answers_json` (jsonb)
- `started_at`, `completed_at`

### 4.3 Агрегированный профиль

`user_taste_profile`
- `user_id` (pk)
- `active_onboarding_version`
- `inference_version` (например `taste_inference_v1`)
- `last_recomputed_at`
- `updated_at`

### 4.4 Теги пользователя

`user_taste_tags`
- `id` (uuid)
- `user_id`
- `taste_code`
- `polarity` (`positive`, `negative`)
- `score` (decimal, -1..1)
- `confidence` (decimal, 0..1)
- `source` (`onboarding`, `behavior`, `mixed`)
- `status` (`active`, `muted`, `rejected`)
- `cooldown_until` (nullable)
- `created_at`, `updated_at`

Индексы:
- `(user_id, status)`
- `(user_id, taste_code, polarity)` unique

### 4.5 Гипотезы

`taste_hypotheses`
- `id` (uuid)
- `user_id`
- `taste_code`
- `polarity`
- `reason_json` (jsonb: какие сигналы повлияли)
- `score`
- `confidence`
- `status` (`new`, `accepted`, `dismissed`, `expired`)
- `dismiss_count`
- `created_at`, `updated_at`

### 4.6 Логи пересчета

`taste_inference_runs`
- `id` (uuid)
- `user_id`
- `trigger` (`onboarding_completed`, `review_created`, `nightly_batch`, ...)
- `version`
- `input_snapshot_json`
- `output_snapshot_json`
- `changed_tags_count`
- `duration_ms`
- `status` (`ok`, `failed`)
- `error_text` (nullable)
- `created_at`

---

## 5. API Contracts (v1)

### 5.1 Onboarding

`GET /v1/taste/onboarding`
- ответ: структура вопросов + версия

`POST /v1/taste/onboarding/complete`
- вход: `version`, `answers`
- эффект: завершение сессии + первичный расчет профиля

### 5.2 Taste map profile

`GET /v1/me/taste-map`
- ответ:
  - `base_preferences[]`
  - `active_tags[]`
  - `hypotheses[]`
  - `last_updated_at`
  - `inference_version`

### 5.3 Управление гипотезами

`POST /v1/me/taste-hypotheses/:id/accept`
`POST /v1/me/taste-hypotheses/:id/dismiss`

### 5.4 Повторный onboarding

`POST /v1/me/taste-map/reset`
- эффект: старт новой onboarding-сессии (история остается)

---

## 6. Inference Logic (v1)

### 6.1 Источники сигналов

- Ответы onboarding.
- Оценки/отзывы (вес зависит от качества отзыва).
- Подтвержденные визиты.
- Явные реакции пользователя на гипотезы (`accept/dismiss`).

### 6.2 Принципы расчета

- Каждому сигналу присваивается вес.
- Итог по тегу = сумма взвешенных сигналов с time decay.
- `confidence` зависит от числа и разнообразия сигналов.
- Отрицательные выводы включать только при строгом пороге.

### 6.3 Формула (черновик)

```text
signal_score(tag) = Σ(weight(event_k, quality_k, source_k) * decay(age_k))

score = clamp(signal_score, -1, 1)
confidence = clamp(log(1 + signals_count) / log(1 + 20), 0, 1)

activate_positive if score >= +0.25 and confidence >= 0.45
activate_negative if score <= -0.35 and confidence >= 0.55
```

### 6.4 Cooldown после dismiss

- Если пользователь `dismiss` гипотезу, система не предлагает ее повторно 30 дней.
- Повтор только при существенном изменении score/confidence.

---

## 7. Product/UI Changes

### 7.1 Регистрация

- Добавить шаг "Карта вкусов" перед первым входом в discovery.
- Прогресс-бар и индикатор оставшегося времени.

### 7.2 Профиль

Новая страница: `Карта вкусов`
- Секция 1: "Ваши базовые вкусы"
- Секция 2: "Наши предположения"
- Секция 3: "Почему мы так решили" (кратко)
- Кнопка "Пройти заново"

### 7.3 Discovery

- Использовать вкус-теги в ранжировании.
- Показать объяснение "Подходит вам: воронка, шоколадный профиль, тихая посадка".

---

## 8. Backend Execution Plan

### Этап 1. Схема и контракты

1. Добавить миграции под таблицы `taste_*`.
2. Реализовать репозитории/модели.
3. Поднять API onboarding и profile.

### Этап 2. Inference engine

1. Реализовать сервис `TasteInferenceService`.
2. Добавить триггеры:
- после завершения onboarding,
- после создания/апдейта отзыва,
- nightly batch.
3. Добавить `taste_inference_runs` и DLQ при ошибках.

### Этап 3. Интеграция в ranking

1. Подключить `user_taste_tags` в выдачу рекомендаций.
2. Добавить explainability-строку в DTO карточки.
3. Повесить feature flag `taste_map_ranking_v1`.

---

## 9. Frontend Execution Plan

### Этап 1. Onboarding UI

1. Экран опроса и completion flow.
2. Клиентский state + отправка в API.
3. Обработка resume при прерывании.

### Этап 2. Профильный экран

1. Новый роут "Карта вкусов".
2. Рендер активных тегов и гипотез.
3. CTA: `Оставить`, `Скрыть`, `Пройти заново`.

### Этап 3. Discovery integration

1. Показ explainability в карточке.
2. Обновление списка после изменения taste-map.

---

## 10. Analytics & Monitoring

### 10.1 Product metrics

- onboarding completion rate.
- taste-page weekly active users.
- hypothesis accept/dismiss ratio.
- uplift `card->route`.

### 10.2 Tech metrics

- inference run success rate.
- inference run P95 duration.
- API error rate (`/v1/me/taste-map`).
- DLQ size for inference jobs.

### 10.3 Alerting

- Ошибки inference > 2% за 15 минут.
- P95 inference duration > 2s.
- 5xx по taste endpoints > 1%.

---

## 11. Test Strategy

### 11.1 Backend

- Unit: inference weights, thresholds, cooldown.
- Integration: onboarding -> profile -> hypotheses lifecycle.
- Contract tests: taste endpoints.

### 11.2 Frontend

- Компонентные тесты onboarding и taste-map страницы.
- E2E сценарий:
1. регистрация;
2. прохождение карты;
3. просмотр профиля;
4. dismiss гипотезы;
5. проверка, что не появляется снова сразу.

### 11.3 Regression

- Проверка, что базовые discovery/reviews flow не деградировали.

---

## 12. Rollout & Feature Flags

- `taste_map_v1` - включает onboarding + profile page.
- `taste_inference_v1` - включает обновление профиля из событий.
- `taste_map_ranking_v1` - включает персонализацию в ранжировании.

План:
1. internal.
2. 10% новых.
3. 50% новых + 10% существующих.
4. полный rollout.

---

## 13. Open Questions

1. Какие именно атрибуты включаем в v1 taxonomy (и сколько максимум)?
2. Делаем ли отрицательные гипотезы в v1 или включаем во v1.1?
3. Нужен ли отдельный onboarding для "гиков" и "казуальных" пользователей?
4. Какой минимальный confidence для показа гипотезы пользователю?

---

## 14. Definition of Done

- Все P0 API и UI доступны под feature flags.
- Запущены product + tech метрики.
- Есть e2e сценарий taste-map.
- Есть rollback-план по флагам.
- Документация обновлена в BuildIn и в репозитории.
