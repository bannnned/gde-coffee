# Taste Map - Execution Runbook

> Рабочий документ для реализации Taste Map по шагам.  
> Принцип: `1 шаг = 1 промпт`, без расползания scope.

## 0. Правила работы

1. На каждом шаге делаем только то, что указано в промпте шага.
2. После каждого шага:
- обновляем статус в трекере;
- заполняем журнал разработки;
- фиксируем открытые вопросы.
3. Если найден blocker:
- не перескакивать к следующему шагу;
- зафиксировать blocker в журнале;
- предложить минимальный unblock plan.
4. Любая новая логика должна быть под feature flags:
- `taste_map_v1`
- `taste_inference_v1`
- `taste_map_ranking_v1`

---

## 1. Статус-трекер шагов

| Step | Название | Статус | Дата | Ссылка на PR/commit |
|---|---|---|---|---|
| 1 | Контракт Taste Map v1 (docs + json) | [x] | 2026-03-05 | - |
| 2 | Миграции БД под taste-map | [x] | 2026-03-05 | - |
| 3 | Backend domain + repositories | [x] | 2026-03-05 | - |
| 4 | API onboarding | [x] | 2026-03-05 | - |
| 5 | API профиля и гипотез | [x] | 2026-03-05 | - |
| 6 | Inference engine v1 + triggers | [x] | 2026-03-06 | - |
| 7 | Frontend onboarding flow | [x] | 2026-03-06 | - |
| 8 | Frontend экран "Профиль вкуса" | [x] | 2026-03-06 | - |
| 9 | Интеграция в ranking + explainability | [x] | 2026-03-06 | - |
| 10 | Метрики, e2e, rollout | [x] | 2026-03-06 | - |

---

## 2. Шаги (1 шаг = 1 промпт для Codex)

## Step 1 - Контракт Taste Map v1

```text
Ты работаешь в репозитории /Users/a1/Desktop/Prog/gde-coffee.

Задача: зафиксировать контракт Taste Map v1 как основу для разработки.

Сделай:
1) Создай/обнови документ docs/taste_map_v1_contract.md:
- taxonomy v1 (коды тегов, группы, polarity rules)
- onboarding questions v1 (6-10 вопросов, типы ответов)
- API DTO черновики для:
  - GET /v1/taste/onboarding
  - POST /v1/taste/onboarding/complete
  - GET /v1/me/taste-map
  - POST /v1/me/taste-hypotheses/:id/accept
  - POST /v1/me/taste-hypotheses/:id/dismiss
- versioning: taste_inference_v1
- feature flags: taste_map_v1, taste_inference_v1, taste_map_ranking_v1

2) Добавь machine-readable файлы:
- docs/taste_taxonomy_v1.json
- docs/taste_onboarding_v1.json

3) Ничего не меняй в runtime-коде backend/frontend на этом шаге.

Критерии приемки:
- Один источник правды по контракту.
- JSON-файлы валидны и соответствуют markdown-документу.

В конце:
- покажи список измененных файлов;
- коротко зафиксируй открытые вопросы.
```

## Step 2 - Миграции БД

```text
Ты работаешь в /Users/a1/Desktop/Prog/gde-coffee.

Задача: добавить миграции БД для Taste Map v1.

Сделай:
1) Добавь SQL-меграции в backend/migrations для таблиц:
- taste_taxonomy
- taste_onboarding_sessions
- user_taste_profile
- user_taste_tags
- taste_hypotheses
- taste_inference_runs
2) Добавь индексы и уникальные ограничения.
3) Добавь seed-миграцию или seed-скрипт для taste_taxonomy из docs/taste_taxonomy_v1.json.
4) Не ломай существующие миграции.

Проверки:
- миграции поднимаются и откатываются;
- нет конфликтов имен/индексов.

В конце:
- перечисли новые migration files;
- кратко опиши схему и ключевые индексы.
```

## Step 3 - Backend domain/repositories

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee.

Задача: реализовать domain/model/repository слой для taste-map таблиц.

Сделай:
1) Добавь модели и репозитории в backend/internal/... по текущей архитектуре проекта.
2) Реализуй CRUD-операции, нужные для:
- onboarding session create/complete
- read/write user_taste_profile
- upsert user_taste_tags
- create/update taste_hypotheses
- create taste_inference_runs
3) Добавь unit tests репозиториев.

Критерии:
- код компилируется;
- базовые unit tests проходят.
```

## Step 4 - API onboarding

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee.

Задача: реализовать onboarding API v1.

Сделай:
1) GET /v1/taste/onboarding (возвращает вопросы и version).
2) POST /v1/taste/onboarding/complete (валидирует ответы, сохраняет session как completed, создает baseline profile).
3) Валидацию входных данных и коды ошибок.
4) Feature flag gate: taste_map_v1.

Тесты:
- handler tests на success/error/validation/flag-off.
```

## Step 5 - API профиля и гипотез

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee.

Задача: реализовать профильные endpoints Taste Map.

Сделай:
1) GET /v1/me/taste-map
2) POST /v1/me/taste-hypotheses/:id/accept
3) POST /v1/me/taste-hypotheses/:id/dismiss
4) Логику cooldown после dismiss (30 дней).
5) Feature flag gate.

Тесты:
- handler + service tests для lifecycle гипотез.
```

## Step 6 - Inference engine v1

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee.

Задача: реализовать taste inference v1.

Сделай:
1) Сервис TasteInferenceService:
- вход: onboarding + reviews + verified visits + hypothesis feedback
- выход: updated user_taste_tags + hypotheses
2) Версионирование: taste_inference_v1.
3) Триггеры запуска:
- после onboarding complete
- после review create/update
- nightly batch job
4) Логирование в taste_inference_runs.
5) Безопасность: идемпотентность, обработка ошибок.

Тесты:
- unit tests формулы и порогов;
- integration tests на полный пересчет.
```

## Step 7 - Frontend onboarding

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee/frontend.

Задача: реализовать UI/flow онбординга Taste Map.

Сделай:
1) Экран/флоу 6-10 шагов по docs/taste_onboarding_v1.json.
2) Сохранение progress локально и отправка completion в API.
3) Обработка loading/error/retry.
4) Подключи feature flag taste_map_v1.
5) Мобильная адаптация.

Тесты:
- component tests;
- smoke e2e onboarding happy path.
```

## Step 8 - Frontend "Профиль вкуса"

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee/frontend.

Задача: сделать профильный экран Taste Map.

Сделай:
1) Новый экран в профиле:
- "Ваш вкус сейчас"
- "Наши предположения"
- "Почему мы так думаем"
- "Пройти карту заново"
2) Действия accept/dismiss гипотез.
3) Пустые/ошибочные состояния.
4) Haptics на key interactions в текущем стиле проекта.

Тесты:
- component tests и один e2e сценарий.
```

## Step 9 - Ranking + Explainability

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee.

Задача: подключить taste profile к выдаче.

Сделай:
1) В backend ranking добавить влияние user_taste_tags под флагом taste_map_ranking_v1.
2) В ответ карточки добавить explainability string.
3) Во frontend показать explainability в карточке/деталях кофейни.

Критерии:
- fallback на старый ранжир при выключенном флаге;
- без деградации latency.
```

## Step 10 - Метрики, e2e, rollout

```text
Репозиторий: /Users/a1/Desktop/Prog/gde-coffee.

Задача: закрыть качество и вывод в прод.

Сделай:
1) События аналитики taste-map (start/complete/show/accept/dismiss/recompute).
2) Дашборд и алерты (ошибки API, inference failures, latency).
3) e2e критического пути:
- регистрация -> onboarding -> профиль -> dismiss -> discovery explainability
4) Документация rollout по стадиям 0/10/50/100%.

В конце:
- чеклист go-live;
- rollback plan по feature flags.
```

---

## 3. Журнал разработки (вести по шагам)

> Заполнять после завершения каждого шага.

### Шаблон записи

```text
## Step N - <название>
Date:
Owner:

Что сделали:
- ...

Ключевые решения:
- ...

Что сознательно НЕ делали (scope guard):
- ...

Измененные файлы:
- ...

Проверки/тесты:
- ...

Риски/долги:
- ...

Open questions:
- ...

Следующий шаг:
- ...
```

### Текущие записи

```text
## Step 0 - Planning baseline
Date: 2026-03-05
Owner: Product/Engineering

Что сделали:
- Зафиксировали дорожную карту 10 шагов.
- Подготовили отдельные документы:
  - docs/buildin_taste_map_template.md
  - docs/taste_map_implementation_plan.md
  - docs/taste_map_ux_system.md

Ключевые решения:
- Работать через CVA-lite подход (descriptive + affective).
- Реализация строго под feature flags.

Что сознательно НЕ делали (scope guard):
- Не меняли runtime-код backend/frontend на этапе планирования.

Измененные файлы:
- docs/buildin_taste_map_template.md
- docs/taste_map_implementation_plan.md
- docs/taste_map_ux_system.md
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- Проверка структуры и полноты документации.

Риски/долги:
- Требуется согласовать taxonomy v1 перед миграциями.

Open questions:
- Негативные гипотезы включать в v1 или v1.1.

Следующий шаг:
- Step 1 (контракт и JSON-спецификации).

## Step 1 - Contract + JSON specs
Date: 2026-03-05
Owner: Engineering

Что сделали:
- Создали основной контракт: docs/taste_map_v1_contract.md.
- Добавили machine-readable спецификации:
  - docs/taste_taxonomy_v1.json
  - docs/taste_onboarding_v1.json
- Зафиксировали draft DTO для 5 API endpoint-ов Taste Map.

Ключевые решения:
- Polarity для flavor/structure: positive + negative.
- Preference/context/serving/milk: только positive.
- Inference/version fields включены в контракт с первого шага.

Что сознательно НЕ делали (scope guard):
- Не меняли runtime-код backend/frontend.
- Не добавляли SQL миграции (это Step 2).

Измененные файлы:
- docs/taste_map_v1_contract.md
- docs/taste_taxonomy_v1.json
- docs/taste_onboarding_v1.json
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- Валидация JSON через jq.
- Ручная сверка JSON и markdown-контракта.

Риски/долги:
- Нужно утвердить уровень строгости negative hypotheses до начала Step 2.

Open questions:
- Негативные гипотезы в v1 или v1.1.
- Нужен ли тег fermented_funky в v1.
- Skip behavior для paired-preference и его влияние на confidence.

Следующий шаг:
- Step 2 (миграции БД).

## Step 2 - DB migrations + taxonomy seed
Date: 2026-03-05
Owner: Engineering

Что сделали:
- Добавили миграцию схемы Taste Map:
  - backend/migrations/000035_taste_map_v1_schema.up.sql
  - backend/migrations/000035_taste_map_v1_schema.down.sql
- Добавили seed-миграцию taxonomy из docs/taste_taxonomy_v1.json:
  - backend/migrations/000036_taste_map_v1_taxonomy_seed.up.sql
  - backend/migrations/000036_taste_map_v1_taxonomy_seed.down.sql

Ключевые решения:
- Таблицы в v1: `taste_taxonomy`, `taste_onboarding_sessions`, `user_taste_profile`, `user_taste_tags`, `taste_hypotheses`, `taste_inference_runs`.
- Для `taste_onboarding_sessions` оставили только одну активную (`status='started'`) сессию на пользователя.
- Для `taste_hypotheses` оставили уникальность одной активной гипотезы (`status='new'`) на `(user_id, taste_code, polarity)`.

Что сознательно НЕ делали (scope guard):
- Не меняли runtime-код backend/frontend.
- Не подключали новые таблицы к API/сервисам (это Step 3+).

Измененные файлы:
- backend/migrations/000035_taste_map_v1_schema.up.sql
- backend/migrations/000035_taste_map_v1_schema.down.sql
- backend/migrations/000036_taste_map_v1_taxonomy_seed.up.sql
- backend/migrations/000036_taste_map_v1_taxonomy_seed.down.sql
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- Проверка миграций и SQL на синтаксис/структуру.
- Проверка соответствия seed и `docs/taste_taxonomy_v1.json`.

Риски/долги:
- Нужно прогнать реальные `up/down` миграции на staging БД перед Step 3.

Open questions:
- Достаточно ли ограничения \"1 active onboarding session per user\" для мульти-девайс сценариев.
- Нужна ли отдельная нормализация/таблица для групп taxonomy (сейчас group_code в check constraint).
- Нужен ли архивный статус у taste tags (сейчас `active|muted|rejected`).

Следующий шаг:
- Step 3 (backend domain + repositories).

## Step 3 - Backend domain + repositories
Date: 2026-03-05
Owner: Engineering

Что сделали:
- Добавили новый доменный пакет `backend/internal/domains/taste`.
- Реализовали модели и repository-слой под таблицы Taste Map:
  - onboarding session create/complete
  - user_taste_profile read/upsert
  - user_taste_tags upsert
  - taste_hypotheses create/update
  - taste_inference_runs create
- Вынесли SQL-константы отдельно.

Ключевые решения:
- Репозиторий построен через `QueryRow`-ориентированный CRUD (insert/update с `returning`).
- Добавлен внутренний конструктор `newRepositoryWithQuerier` для unit-тестов без реальной БД.
- Дефолты версий/статусов выставляются на repository-уровне (`taste_inference_v1`, `new`, `active`, `mixed`).

Что сознательно НЕ делали (scope guard):
- Не добавляли HTTP handlers/services/use-cases (это Step 4+).
- Не подключали роутинг в приложение.

Измененные файлы:
- backend/internal/domains/taste/types.go
- backend/internal/domains/taste/repository_sql.go
- backend/internal/domains/taste/repository.go
- backend/internal/domains/taste/repository_test.go
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `go test ./internal/domains/taste` - passed.

Риски/долги:
- Нужны интеграционные тесты на реальной БД после подключения API слоя (Step 4/5).

Open questions:
- Где фиксировать validation boundary: в handler/service или частично в repository.
- Нужны ли batch-методы upsert для `user_taste_tags`/`taste_hypotheses` до Step 6.
- Нужна ли отдельная операция `get hypothesis by id` в repository для Step 5 UX-потока.

Следующий шаг:
- Step 4 (API onboarding).

## Step 4 - API onboarding
Date: 2026-03-05
Owner: Engineering

Что сделали:
- Реализовали onboarding API v1 в домене `taste`:
  - `GET /v1/taste/onboarding` (и `/api/v1/taste/onboarding` alias)
  - `POST /v1/taste/onboarding/complete` (и `/api/v1/taste/onboarding/complete` alias)
- Добавили feature flag gate `taste_map_v1` через env `TASTE_MAP_V1_ENABLED`.
- Реализовали валидацию payload onboarding-ответов по типам шагов (`single_choice`, `multi_choice`, `range`, `paired_preference`) с кодом `invalid_argument`.
- На completion:
  - создается/завершается onboarding session;
  - формируются baseline taste signals/tags;
  - upsert в `user_taste_tags` и `user_taste_profile`.
- Подключили роутинг и инициализацию handler в `backend/main.go`.

Ключевые решения:
- Onboarding contract загружается из embed-файла `contracts/taste_onboarding_v1.json` в runtime, чтобы API не зависел от внешнего `docs/`.
- Возвращаем `404 feature_disabled` при выключенном флаге для явного soft-launch поведения.
- Поддержаны оба path-style (`/api/v1/...` и `/v1/...`) для совместимости текущего фронта и публичного контракта.

Что сознательно НЕ делали (scope guard):
- Не реализовывали endpoints профиля/гипотез (это Step 5).
- Не добавляли inference triggers/job orchestration (это Step 6).
- Не меняли frontend flow (это Step 7+).

Измененные файлы:
- backend/internal/domains/taste/handler.go
- backend/internal/domains/taste/service.go
- backend/internal/domains/taste/errors.go
- backend/internal/domains/taste/flags.go
- backend/internal/domains/taste/onboarding_catalog.go
- backend/internal/domains/taste/handler_test.go
- backend/main.go
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `go test ./internal/domains/taste` - passed.
- `go test ./... -run '^$'` (compile-only sanity check) - passed.

Риски/долги:
- Пока нет интеграционного e2e теста onboarding через реальную БД + auth middleware цепочку.
- `TASTE_MAP_V1_ENABLED` читается напрямую из env; нужно унифицировать с общей системой feature flags в конфиге при rollout.

Open questions:
- Нужно ли ограничивать максимальное число answers/размер payload для анти-абьюза на handler-уровне.
- Нужна ли дедупликация/идемпотентность completion по `session_id` при повторной отправке от клиента с плохой сетью.
- Нужен ли дополнительный audit-event (`taste_onboarding_completed`) в общую analytics pipeline уже на Step 4 или оставить на Step 10.

Следующий шаг:
- Step 5 (API профиля и гипотез) после ручной проверки текущего Step 4 в релизном окружении.

## Step 5 - API профиля и гипотез
Date: 2026-03-05
Owner: Engineering

Что сделали:
- Реализовали endpoint-ы профиля Taste Map:
  - `GET /v1/me/taste-map` (и `/api/v1/me/taste-map` alias)
  - `POST /v1/me/taste-hypotheses/:id/accept` (и `/api/v1/...` alias)
  - `POST /v1/me/taste-hypotheses/:id/dismiss` (и `/api/v1/...` alias)
- Для dismiss добавили cooldown логику: `30 дней` от момента dismiss.
- В сервисе добавили lifecycle обработку гипотез:
  - accept -> статус гипотезы `accepted` + upsert `user_taste_tags` как `active` с `source=explicit_feedback`;
  - dismiss -> статус `dismissed`, `dismiss_count + 1`, `cooldown_until=now+30d` + upsert `user_taste_tags` как `muted`.
- Добавили получение profile view:
  - `base_map` (версия onboarding + completed_at);
  - `active_tags`;
  - actionable hypotheses (`status='new'`, не в cooldown).
- Добавили repository-операции для:
  - `ListActiveUserTasteTags`
  - `ListActionableTasteHypotheses`
  - `GetTasteHypothesisByID`
- Добавили mapping доменной ошибки `ErrTasteHypothesisNotFound` -> HTTP 404.

Ключевые решения:
- Для UX/контракта в профильной выдаче показываем только actionable hypotheses (новые и не в cooldown), чтобы не засорять UI историей.
- Повторный dismiss во время активного cooldown обрабатывается идемпотентно (возвращаем текущее состояние без нового инкремента).
- Фича продолжает быть под `taste_map_v1` (env `TASTE_MAP_V1_ENABLED`) на всех новых endpoint-ах.

Что сознательно НЕ делали (scope guard):
- Не запускали inference triggers и пересчеты после feedback (это Step 6).
- Не трогали frontend интеграцию/экраны Taste Map (это Step 7+).
- Не добавляли аналитические events в pipeline (это Step 10).

Измененные файлы:
- backend/internal/domains/taste/repository_sql.go
- backend/internal/domains/taste/repository.go
- backend/internal/domains/taste/service.go
- backend/internal/domains/taste/service_profile.go
- backend/internal/domains/taste/errors.go
- backend/internal/domains/taste/handler.go
- backend/internal/domains/taste/handler_test.go
- backend/internal/domains/taste/service_profile_test.go
- backend/main.go
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `go test ./internal/domains/taste` - passed.
- `go test ./... -run '^$'` (compile-only sanity check) - passed.

Риски/долги:
- Нет интеграционного e2e теста реального auth+DB сценария по endpoint-ам `/v1/me/*`.
- Пока не добавлена отдельная история/аудит изменений гипотез (кроме текущих reason_json полей).

Open questions:
- Нужно ли в `GET /v1/me/taste-map` отдавать историю hypotheses (`accepted/dismissed`) отдельным блоком или оставлять только actionable.
- Должен ли повторный dismiss после истечения cooldown создавать новую гипотезу или переиспользовать текущую запись (сейчас переиспользуем и инкрементим dismiss_count).
- Нужен ли отдельный endpoint для \"reset hypothesis feedback\" (ручной откат accept/dismiss) для поддержки и модерации.

Следующий шаг:
- Step 6 (Inference engine v1 + triggers) после ручной проверки Step 5 в релизном окружении и разборе open questions.

## Step 6 - Inference engine v1 + triggers
Date: 2026-03-06
Owner: Engineering

Что сделали:
- Реализовали `taste inference v1` в backend (`service_inference.go`) с входами:
  - onboarding baseline (через текущие `user_taste_tags` + профиль),
  - reviews (`review_attributes.taste_tags`, drink, rating, summary),
  - verified visits (через confidence в `visit_verifications`),
  - hypothesis feedback (`accepted/dismissed` в `taste_hypotheses`).
- Добавили пересчет профиля:
  - build accumulators -> build candidates -> upsert `user_taste_tags`,
  - reconcile гипотез (создание новых `new` и `expire` неактуальных).
- Добавили логирование каждого прогона в `taste_inference_runs`:
  - input/output snapshots,
  - changed tags count,
  - duration,
  - статус `ok/failed` + error_text для fail-case.
- Добавили триггеры запуска:
  - best-effort сразу после `onboarding complete`,
  - review-driven worker (poll-based пересчет для пользователей с новыми/обновленными отзывами),
  - nightly batch worker (в UTC-час, configurable).
- Добавили advisory lock по user_id (`pg_try_advisory_lock`) для защиты от параллельных пересчетов.

Ключевые решения:
- Для надежности текущей архитектуры использован poll-driven trigger на review activity, без врезки в существующий reviews inbox consumer.
- Inference и воркеры включаются отдельным флагом `TASTE_INFERENCE_V1_ENABLED`.
- Nightly окно конфигурируется `TASTE_INFERENCE_NIGHTLY_HOUR_UTC` (по умолчанию 03:00 UTC).

Что сознательно НЕ делали (scope guard):
- Не подключали персонализацию ранжирования discovery (это Step 9).
- Не добавляли продуктовую аналитику/дашборды inference событий (это Step 10).
- Не реализовывали отдельный API ручного запуска inference для админов.

Измененные файлы:
- backend/internal/domains/taste/service_inference.go
- backend/internal/domains/taste/service_inference_test.go
- backend/internal/domains/taste/repository_inference.go
- backend/internal/domains/taste/repository_sql.go
- backend/internal/domains/taste/service.go
- backend/internal/domains/taste/handler.go
- backend/internal/domains/taste/errors.go
- backend/internal/domains/taste/flags.go
- backend/main.go
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `go test ./internal/domains/taste` - passed.
- `go test ./... -run '^$'` (compile-only sanity check) - passed.

Риски/долги:
- Review-driven trigger пока poll-based, не event-driven по inbox consumer.
- Маппинг review `taste_tags`/summary -> taxonomy эвристический, требует реальных продуктовых калибровок.
- Нет отдельного админского visibility endpoint для диагностики inference quality per-user.

Open questions:
- Нужен ли переход на полноценный inbox consumer `taste.inference.v1` после стабилизации (вместо poll worker).
- Какие пороги `score/confidence` считать продовыми для генерации гипотез (сейчас conservative defaults)?
- Нужно ли вводить hard-cap на число одновременно активных hypotheses на пользователя (например, <= 5)?

Следующий шаг:
- Step 7 (Frontend onboarding flow), после ручной проверки inference на staging/production data.

## Step 7 - Frontend onboarding flow
Date: 2026-03-06
Owner: Engineering

Что сделали:
- Реализовали полноценный UI-flow onboarding Taste Map в новом экране:
  - `/taste/onboarding`
  - динамический рендер шагов `single_choice`, `multi_choice`, `range`, `paired_preference`.
- Подключили API:
  - `GET /api/v1/taste/onboarding`
  - `POST /api/v1/taste/onboarding/complete`
- Добавили локальное сохранение прогресса onboarding в `localStorage`:
  - восстанавливаем step + answers после перезахода;
  - очищаем прогресс при успешном completion.
- Добавили состояния `loading/error/retry` и success-screen после completion.
- Подключили feature flag `taste_map_v1` на фронте:
  - env `VITE_TASTE_MAP_V1_ENABLED`;
  - при выключенном флаге экран и CTA скрываются/показывают недоступность.
- Добавили вход в flow из профиля (кнопка `Карта вкуса` при включенном флаге).

Ключевые решения:
- Рендер шага полностью driven by contract из backend (без hardcode списка вопросов в UI).
- Для `range/paired_preference` используем безопасные дефолты, чтобы не терять прогресс и не блокировать required-поля.
- Валидация шага выполняется перед переходом `Дальше`, а перед submit делается полный проход по required шагам.

Что сознательно НЕ делали (scope guard):
- Не реализовывали экран `Профиль вкуса` и действия по hypotheses (это Step 8).
- Не встраивали onboarding в обязательный post-registration redirect.
- Не добавляли продуктовую аналитику событий onboarding (это Step 10).

Измененные файлы:
- frontend/src/api/taste.ts
- frontend/src/features/taste/model/flags.ts
- frontend/src/features/taste/model/onboardingProgress.ts
- frontend/src/pages/TasteOnboardingPage.tsx
- frontend/src/pages/TasteOnboardingPage.module.css
- frontend/src/pages/TasteOnboardingPage.test.tsx
- frontend/src/pages/TasteOnboardingPage.smoke.test.tsx
- frontend/src/App.tsx
- frontend/src/pages/ProfileScreen.tsx
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `npm test` - passed.
- `npm run build` (includes `tsc --noEmit`) - passed.

Риски/долги:
- Пока нет отдельного onboarding-progress sync между устройствами (храним локально в браузере).
- Текущий flow не проверяет \"уже завершенный onboarding\" перед стартом (повторный проход разрешен).
- Сообщение о выключенном флаге завязано на env и backend 404; нужна финальная продуктовая формулировка.

Open questions:
- Нужно ли автоматически предлагать onboarding сразу после регистрации/первого входа.
- Нужно ли для optional шагов сохранять/отправлять `skip` как явный сигнал, или продолжать omit-политику.
- Нужен ли `session_id` на фронте для strict idempotency completion retries при нестабильной сети.

Следующий шаг:
- Step 8 (Frontend экран \"Профиль вкуса\") после ручной проверки UX onboarding на мобиле и десктопе.

## Step 8 - Frontend экран "Профиль вкуса"
Date: 2026-03-06
Owner: Engineering

Что сделали:
- Реализовали новый экран `/taste/profile` с блоками:
  - `Ваш вкус сейчас` (active tags);
  - `Наши предположения` (actionable hypotheses);
  - `Почему мы так думаем` (explainability/insights);
  - `Обновить карту вкуса` с переходом в `/taste/onboarding`.
- Подключили profile API и действия по гипотезам:
  - `GET /api/v1/me/taste-map`
  - `POST /api/v1/me/taste-hypotheses/:id/accept`
  - `POST /api/v1/me/taste-hypotheses/:id/dismiss`
- Добавили состояния `loading/error/retry`, `feature off`, `auth required`, `empty state`.
- Добавили haptics на ключевые действия:
  - selection на интеракциях,
  - success/warning на accept/dismiss,
  - error при неуспешном feedback.
- Интегрировали экран в приложение:
  - route `/taste/profile` в `App.tsx`;
  - вход из профиля: кнопка `Профиль вкуса`.
- Добавили тесты:
  - component test для рендера + accept/retry;
  - smoke тест на переход `Пройти карту заново`.

Ключевые решения:
- Экран построен как read-model поверх `GET /me/taste-map`, без дублирования логики inference на фронте.
- Для объяснимости показываем метаданные (версия inference, время обновления, сигналы базы + причины гипотез).
- После accept/dismiss выполняем рефреш профиля, чтобы UI всегда показывал актуальное состояние.

Что сознательно НЕ делали (scope guard):
- Не добавляли персонализацию ранжирования discovery и explainability карточек (это Step 9).
- Не включали analytics события taste-profile (это Step 10).
- Не меняли onboarding contract/DTO (это уже зафиксировано на предыдущих шагах).

Измененные файлы:
- frontend/src/api/taste.ts
- frontend/src/features/taste/model/tasteLabels.ts
- frontend/src/pages/TasteProfilePage.tsx
- frontend/src/pages/TasteProfilePage.module.css
- frontend/src/pages/TasteProfilePage.test.tsx
- frontend/src/pages/TasteProfilePage.smoke.test.tsx
- frontend/src/pages/ProfileScreen.tsx
- frontend/src/App.tsx
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `npm test` - passed.
- `npm run build` (includes `tsc --noEmit`) - passed.

Риски/долги:
- Пока не добавлен визуальный diff test для layout в мобильных брейкпоинтах.
- Список `tasteLabels` на фронте нужно синхронизировать при изменениях taxonomy v1/v2.
- Нет серверного поля explainability severity/prioritization, в UI сейчас простой список строк.

Open questions:
- Нужен ли отдельный блок истории feedback (`accepted/dismissed`) на экране профиля вкуса.
- Нужно ли давать пользователю ручную правку активных тегов (кроме accept/dismiss гипотез).
- Должна ли кнопка `Профиль вкуса` вести на onboarding, если у пользователя еще нет baseline карты.
- После релиза пройти ручную проверку flow и закрыть open questions этого шага отдельной записью.

Следующий шаг:
- Step 9 (интеграция taste profile в ranking + explainability выдачи).

## Step 9 - Интеграция в ranking + explainability
Date: 2026-03-06
Owner: Engineering

Что сделали:
- В backend добавили персонализацию выдачи `/api/cafes` по `user_taste_tags` под feature flag `taste_map_ranking_v1`:
  - env: `TASTE_MAP_RANKING_V1_ENABLED`;
  - при выключенном флаге логика остается прежней (сортировка по дистанции).
- Реализовали слой taste-ranking в домене `cafes`:
  - загрузка активных пользовательских taste-сигналов (`user_taste_tags`);
  - загрузка taste-токенов кофейни из `cafe_rating_snapshots.components` (`specific_tags` + `descriptive_tags`);
  - мягкий re-rank по совпадению/анти-совпадению вкусовых сигналов;
  - генерация explainability-строки на карточку кофейни.
- Расширили API response карточки кофейни:
  - поле `explainability` в `CafeResponse` (omitempty).
- Подключили explainability во frontend:
  - в карточке кофейни в списке (`CafeCardFooter`);
  - в деталях кофейни (`AboutSection`).
- Добавили unit tests для алгоритма персонализации:
  - кейс positive match поднимает релевантную кофейню выше;
  - кейс negative match понижает кофейню и показывает соответствующее объяснение.

Ключевые решения:
- Персонализация реализована как post-processing поверх базовой сортировки по расстоянию: это уменьшает риск резких регрессий discovery UX.
- Любая ошибка персонализации приводит к graceful fallback на прежний порядок без отказа endpoint-а.
- Explainability формируется только при наличии валидных сигналов и реального taste-match.

Что сознательно НЕ делали (scope guard):
- Не меняли формулу rating snapshot (`rating_v2`) и не вмешивались в пересчет рейтингов.
- Не внедряли ML/reranker модель, использовали rule-based matching v1.
- Не добавляли analytics/dashboards по качеству персонализации (это Step 10).

Измененные файлы:
- backend/internal/model/cafe.go
- backend/internal/domains/cafes/flags.go
- backend/internal/domains/cafes/service.go
- backend/internal/domains/cafes/repository.go
- backend/internal/domains/cafes/taste_ranking.go
- backend/internal/domains/cafes/taste_ranking_test.go
- frontend/src/entities/cafe/model/types.ts
- frontend/src/features/discovery/components/cafe-card/CafeCardFooter.tsx
- frontend/src/features/discovery/ui/details/sections/AboutSection.tsx
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `go test ./internal/domains/cafes` - passed.
- `go test ./... -run '^$'` (compile-only sanity check) - passed.
- `npm test` - passed.
- `npm run build` (includes `tsc --noEmit`) - passed.

Риски/долги:
- Текущий matcher rule-based и зависит от словарей токенов; потребуется калибровка на реальных данных.
- `specific_tags/descriptive_tags` не всегда содержат полные вкусовые сигналы для всех taxonomy-кодов.
- Пока нет явной продуктовой метрики quality lift для personalized ranking.

Open questions:
- Нужен ли отдельный API-debug блок для explainability (например, matched tags + score) для модерации/поддержки.
- Какой целевой лимит сдвига позиций считать безопасным в проде (сейчас мягкий буст на несколько позиций).
- Нужно ли хранить/логировать факт применения персонализации per-request для аналитики rollout.
- После релиза пройти ручную проверку влияния personalized выдачи в приложении и закрыть эти open questions отдельной записью.

Следующий шаг:
- Step 10 (метрики, e2e, rollout).

## Step 10 - Метрики, e2e, rollout
Date: 2026-03-06
Owner: Engineering

Что сделали:
- Закрыли analytics events Taste Map end-to-end:
  - frontend: `taste_onboarding_started`, `taste_onboarding_completed`, `taste_hypothesis_shown`, `taste_hypothesis_confirmed`, `taste_hypothesis_dismissed`, `taste_api_error`;
  - backend inference: `taste_profile_recomputed` при успешном run.
- Расширили контракты и ingestion-пайплайн метрик:
  - добавили новые event types в backend validation и SQL CHECK constraint (`product_metrics_events_type_chk`);
  - добавили миграцию `000037_product_metrics_taste_events`.
- Реализовали admin dashboard/report для Taste Map:
  - новый endpoint `GET /api/admin/metrics/taste-map`;
  - summary + daily + alerts (API errors, inference failures, inference latency, onboarding completion degradation);
  - подключение в `AdminNorthStarPage` с отдельным блоком `Taste Map health`.
- Добавили smoke-критический путь:
  - `registration -> onboarding -> profile -> dismiss -> discovery explainability`.
- Зафиксировали rollout-документацию:
  - стадии `0/10/50/100`;
  - go-live checklist;
  - rollback plan через feature flags.
- Добавили тест на frontend parser для `getAdminTasteMap`.

Ключевые решения:
- Вся analytics отправка best-effort и не блокирует UX.
- Событие `taste_profile_recomputed` создается сервером из inference run, чтобы не зависеть от клиентского состояния.
- Dashboard Taste Map живет рядом с North Star/Map Perf в одном admin-экране для единой операционной панели.
- Rollback-first подход: первичное выключение ranking/inference/UI флагами без отката схемы БД.

Что сознательно НЕ делали (scope guard):
- Не внедряли внешнюю BI-систему (Looker/Metabase) на этом шаге.
- Не добавляли дополнительные пользовательские пуши/уведомления по событиям Taste Map.
- Не трогали пост-step cleanup (удаление runbook и редизайн cleanup) до команды после релизной проверки.

Измененные файлы:
- backend/internal/domains/metrics/types.go
- backend/internal/domains/metrics/service.go
- backend/internal/domains/metrics/repository.go
- backend/internal/domains/metrics/handler.go
- backend/internal/domains/metrics/handler_test.go
- backend/internal/domains/metrics/service_test.go
- backend/internal/domains/taste/service_inference.go
- backend/internal/domains/taste/repository_inference.go
- backend/main.go
- backend/migrations/000037_product_metrics_taste_events.up.sql
- backend/migrations/000037_product_metrics_taste_events.down.sql
- frontend/src/api/metrics.ts
- frontend/src/api/adminMetrics.ts
- frontend/src/api/adminMetrics.test.ts
- frontend/src/pages/TasteOnboardingPage.tsx
- frontend/src/pages/TasteProfilePage.tsx
- frontend/src/pages/AdminNorthStarPage.tsx
- frontend/src/pages/TasteMapCriticalPath.smoke.test.tsx
- docs/taste_map_rollout_v1.md
- docs/taste_map_execution_runbook.md

Проверки/тесты:
- `go test ./internal/domains/metrics` - passed.
- `go test ./internal/domains/taste` - passed.
- `go test ./... -run '^$'` - passed.
- `npm test` - passed.
- `npm run build` (includes `tsc --noEmit`) - passed.

Риски/долги:
- Thresholds для Taste Map alerts пока статические; после 1-2 недель прод-данных потребуется калибровка.
- `taste_api_error` метрика агрегируется на клиентских событиях и может недоучитывать ошибки при полном offline.
- Нужен пост-релиз контроль noisy alerts (возможны ложные срабатывания на низком трафике).

Open questions:
- Нужна ли отдельная витрина для сравнения lift персонализации (control vs treatment) в админке.
- Нужны ли алерты по confirm/dismiss drift для детекта деградации гипотез.
- После релиза пройти ручную проверку сценария в проде и закрыть все Open questions шагов 7-10 отдельной записью.

Следующий шаг:
- После релизной проверки: выполнить раздел `4. Финал проекта` (удаление runbook + актуализация `docs/redesign/**`).
```

---

## 4. Финал проекта (обязательные действия)

После закрытия Step 10:

1. Удалить этот рабочий файл:
- `docs/taste_map_execution_runbook.md`

2. Сделать cleanup/актуализацию документации редизайна:
- пройтись по существующим md в `docs/redesign/**`;
- удалить неактуальные шаги и устаревшие куски;
- обновить нужные секции под новую систему Taste Map;
- добавить недостающие блоки, если в redesign-документах нет описания новых экранов/потоков.

3. Добавить короткий итоговый changelog-документ:
- что реализовано;
- какие флаги включены;
- что оставлено в backlog.

4. Пост-релизная проверка и разбор открытых вопросов:
- после релиза пользователь вручную проверяет работоспособность в приложении;
- после этой проверки команда проходит по всем `Open questions` из шагов и фиксирует решения;
- подтвержденные решения обновляются в документации и backlog.
