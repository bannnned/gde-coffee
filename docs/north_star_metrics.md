# North Star Metrics (V1)

## Цель
Зафиксировать продуктовую метрику:

- **North Star:** полезные подтвержденные отзывы, которые реально читают перед визитом.

В коде это считается как:

- `journey` попадает в знаменатель, если в нем был `route_click` или `checkin_start`.
- `journey` попадает в числитель, если до намерения визита был `review_read` по отзыву, который:
  - подтвержден визитом (`visit_verifications.verified_at IS NOT NULL`, `confidence != 'none'`),
  - имеет минимум один голос полезности (`helpful_votes`).

## Что внедрено

### Сбор событий
Добавлена таблица:

- `public.product_metrics_events`

Миграция:

- `backend/migrations/000026_product_metrics_events.up.sql`
- `backend/migrations/000026_product_metrics_events.down.sql`

События V1:

- `cafe_card_open`
- `review_read`
- `route_click`
- `checkin_start`
- `review_submit`

### API

- `POST /api/metrics/events` (optional auth)
  - принимает батч событий (`events[]`)
  - поддерживает дедупликацию по `client_event_id`
- `GET /api/admin/metrics/north-star?days=14&cafe_id=<uuid>` (admin/moderator)
  - возвращает summary и daily-ряд
- `GET /api/admin/metrics/funnel?days=14&cafe_id=<uuid>` (admin/moderator)
  - возвращает funnel по journeys:
    - карточка открыта
    - прочитан отзыв
    - открыт маршрут
    - начат check-in
    - опубликован отзыв
- `GET /api/admin/cafes/search?q=<name>&limit=15` (admin/moderator)
  - серверный поиск кофеен по названию для фильтра метрики

Подключение роутов:

- `backend/main.go`
- домен: `backend/internal/domains/metrics/`

### Frontend tracking

Добавлен API-клиент:

- `frontend/src/api/metrics.ts`

Реализовано:

- `cafe_card_open` при выборе/открытии карточки кофейни
  - `frontend/src/features/discovery/hooks/useDiscoveryPageController.ts`
- `route_click` при открытии маршрута в 2ГИС/Яндекс
  - `frontend/src/features/discovery/hooks/useDiscoveryPageController.ts`
- `checkin_start` после успешного check-in
  - `frontend/src/features/discovery/ui/details/reviews/useReviewsSectionController.ts`
- `review_submit` после публикации нового отзыва
  - `frontend/src/features/discovery/ui/details/reviews/useReviewsSectionController.ts`
- `review_read`
  - карточка отзыва видима >= 3 секунды (IntersectionObserver)
  - дополнительный сигнал при открытии полного отзыва
  - файлы:
    - `frontend/src/features/discovery/ui/details/reviews/ReviewFeed.tsx`
    - `frontend/src/features/discovery/ui/details/reviews/useReviewsSectionController.ts`

Для связывания действий используется `journey_id`:

- генерируется при выборе кофейни в Discovery,
- передается в деталку кофейни и далее в секцию отзывов.

## Формат события

```json
{
  "client_event_id": "m8u9...",
  "event_type": "review_read",
  "anon_id": "anon_...",
  "journey_id": "journey_<cafe>_<ts>_<rnd>",
  "cafe_id": "<uuid>",
  "review_id": "<uuid>",
  "provider": "2gis",
  "occurred_at": "2026-02-21T12:00:00Z",
  "meta": {
    "source": "discovery"
  }
}
```

## Вычисление метрики

Расчет выполнен в SQL (репозиторий `metrics`):

1. Берутся `journey` с намерением визита (`route_click`, `checkin_start`) в диапазоне дат.
2. Для тех же `journey` ищутся `review_read`, где отзыв одновременно:
   - verified,
   - helpful.
3. В daily и summary попадает только чтение, произошедшее **до** первого намерения визита в этом `journey`.

## Ограничения V1

- Метрика считается по данным в БД (без внешней аналитики).
- Для неавторизованных пользователей требуется `anon_id`.
- Диапазон `days` в админ-эндпоинте: `1..90`.
- `cafe_id` в админ-эндпоинте опционален: без него метрика считается по всему продукту, с ним — по конкретной кофейне.
- Телеметрия best-effort: отправка с фронта не блокирует UX.

## Funnel (V1)

- Funnel строится по `journey_id` и считает этапы в строгой последовательности:
  1. `cafe_card_open`
  2. `review_read`
  3. `route_click`
  4. `checkin_start`
  5. `review_submit`
- Фильтр `cafe_id` опционален и работает так же, как в North Star.

## Репутация (V1.1)

Чтобы поддержать North Star качеством контента, включена модель репутации `reputation_v1_1`:

- веса событий:
  - `helpful_received`: `+2 * voter_weight`
  - `visit_verified`: `+3 / +6 / +8` (`low / medium / high`)
  - `abuse_confirmed`: `-25`
- daily cap:
  - `helpful_received`: `+20` в день
  - `visit_verified`: `+24` в день
- затухание очков:
  - `<= 90` дней: `1.0`
  - `91..180` дней: `0.7`
  - `181..365` дней: `0.4`
  - `> 365` дней: `0.2`
- уровень и прогресс:
  - пороги: `0, 40, 120, 180, 320, 500, 750`
  - в API профиля отдаются `level`, `level_progress`, `points_to_next_level`.

## AI Summary Ops (V1)

- Добавлена таблица `public.ai_summary_metrics` для операционных метрик AI-суммаризации:
  - `status`, `reason`, `model`
  - `used_reviews`, `prompt_tokens`, `completion_tokens`, `total_tokens`
  - `input_hash`, `metadata`, `created_at`
- Миграция:
  - `backend/migrations/000029_ai_summary_metrics.up.sql`
  - `backend/migrations/000029_ai_summary_metrics.down.sql`
- В метрики пишутся события:
  - `ok` (успешный AI-ответ),
  - `cache_hit` (переиспользован прошлый результат),
  - `budget_blocked` (запрос пропущен лимитом),
  - `error` / `prepare_error` (ошибки подготовки/вызова).

### Daily Budget Guard

- Конфиг:
  - `AI_SUMMARY_BUDGET_GUARD_ENABLED=false` (по умолчанию выключен),
  - `AI_SUMMARY_DAILY_TOKEN_BUDGET=0` (лимит в токенах/день).
- Лимит считается по сумме `total_tokens` за текущий UTC-день.
- Ручной админ-триггер (`force`) guard не блокирует.

### Prompt Versioning

- Добавлено версионирование prompt для AI summary:
  - `AI_SUMMARY_PROMPT_VERSION=review_summary_ru_v1|review_summary_ru_v2`
  - по умолчанию: `review_summary_ru_v1`
- Примененная версия prompt отдается в:
  - `ai_summary.prompt_version` в rating snapshot/diagnostics,
  - `GET /api/admin/reviews/versioning` в секции `ai_summary`,
  - метаданных `ai_summary_metrics`.

### Reviews/AI Health Dashboard API

- Добавлен endpoint:
  - `GET /api/admin/reviews/health` (admin/moderator)
- Возвращает:
  - AI конфиг (model/prompt version/budget settings),
  - окна метрик `last_24h`, `last_7d`,
  - состояние очередей outbox/inbox и открытый DLQ,
  - покрытие пересчетов и последние `ok/error` события.
