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
| 4 | API onboarding | [ ] | - | - |
| 5 | API профиля и гипотез | [ ] | - | - |
| 6 | Inference engine v1 + triggers | [ ] | - | - |
| 7 | Frontend onboarding flow | [ ] | - | - |
| 8 | Frontend экран "Профиль вкуса" | [ ] | - | - |
| 9 | Интеграция в ranking + explainability | [ ] | - | - |
| 10 | Метрики, e2e, rollout | [ ] | - | - |

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
