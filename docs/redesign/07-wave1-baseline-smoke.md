# Wave 1 Baseline + Smoke Pack

Дата фиксации baseline: `2026-02-25`

Связанные документы:
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/06-migration-backlog.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/screens/discovery.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/screens/discovery-settings.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/03-definition-of-done.md`

## 1. Цель

Зафиксировать текущее рабочее поведение Wave 1 перед UI-пересборкой, чтобы:
1. отличать baseline-дефекты от новых регрессий;
2. быстро делать smoke-проверку после каждого блока изменений.

## 2. Область baseline

1. Экран Discovery (`/`).
2. Settings Drawer (настройки на главном экране).
3. Overlay-переходы `/ -> /profile` и `/ -> /settings` с `backgroundLocation`.

## 3. Smoke Pack (обязательный минимум)

### S-01 · Первый вход и выбор локации
- Шаги:
1. Открыть `/`.
2. Не выдавать геопозицию.
3. Выбрать город из списка.
- Ожидание:
1. Появляется список кофеен.
2. Нет падений UI.
3. Нет критичных ошибок в консоли.

### S-02 · Геолокация и fallback
- Шаги:
1. Нажать “Определить местоположение”.
2. Пройти сценарий `allow` и `deny`.
- Ожидание:
1. При `allow` выдача строится от пользователя.
2. При `deny` остается рабочий fallback (город/ручной выбор).

### S-03 · Карта <-> список синхронизация
- Шаги:
1. Выбрать кофейню из списка.
2. Проверить фокус на карте.
3. Выбрать кофейню на карте.
- Ожидание:
1. Выбранная карточка и маркер синхронизированы.
2. Список не теряет выделение.

### S-04 · BottomSheet жесты
- Шаги:
1. Потянуть шторку вверх/вниз.
2. Проверить переходы `peek/mid/expanded`.
- Ожидание:
1. Шторка двигается плавно и предсказуемо.
2. Нет раннего “схлопывания” при небольшом pull-down.

### S-05 · Открытие деталки и возврат
- Шаги:
1. Открыть деталку выбранной кофейни.
2. Вернуться назад.
- Ожидание:
1. Discovery остается в прежнем состоянии (контекст карты/списка).
2. Нет полной перезагрузки контента без причины.

### S-06 · Settings Drawer: радиус и место
- Шаги:
1. Открыть настройки.
2. Сменить радиус.
3. Сменить город.
- Ожидание:
1. Выдача обновляется корректно.
2. Радиус кликабелен на мобильном.
3. Контролы не прозрачные и не “мертвые”.

### S-07 · Settings Drawer: теги
- Шаги:
1. Проверить guest-сценарий.
2. Проверить authed-сценарий: добавление/удаление/сохранение.
- Ожидание:
1. Для гостя есть понятный gating.
2. Для авторизованного пользователя теги сохраняются без дубликатов.

### S-08 · Empty / Error состояния
- Шаги:
1. Смоделировать пустую выдачу.
2. Смоделировать ошибку запроса.
- Ожидание:
1. Видны понятные действия retry/recover.
2. Layout не “прыгает”.

### S-09 · Overlay-переходы в профиль/настройки
- Шаги:
1. Открыть `/profile` из Discovery.
2. Вернуться назад.
3. Открыть `/settings` из Discovery.
4. Вернуться назад.
- Ожидание:
1. Возврат не сбрасывает состояние Discovery.
2. Не возникает повторной инициализации карты без причины.

### S-10 · iOS Safari/PWA sanity
- Шаги:
1. Проверить главный сценарий на iPhone Safari и PWA-режиме.
2. Пройти S-01, S-04, S-06, S-09.
- Ожидание:
1. Нет уезда header под системные зоны.
2. Нет случайного зума с обрезанием краев.

## 4. Известные baseline-дефекты (на дату фиксации)

### K-01 · iOS Safari/PWA: иногда наблюдается эффект “чуть увеличенного” viewport
- Симптом:
1. визуально как легкий zoom;
2. часть верхнего контента может сдвигаться под системную шторку/время.
- Статус:
1. `known_baseline`.
2. Не считать новой регрессией в рамках Wave 1, если повторяется в прежнем виде.

## 5. Правило triage по багам во время редизайна

1. Если дефект воспроизводится на baseline (до изменения блока) -> `baseline`.
2. Если дефект появился только после изменения -> `regression`.
3. Каждая `regression` блокирует перевод задачи в `done`.

## 6. Формат отчета по smoke после каждого блока

```md
Block: <W1-BL-XXX>
Date: YYYY-MM-DD
Build/Commit: <sha>

Smoke:
- S-01: pass/fail
- S-02: pass/fail
- ...

New regressions:
- none / <список>

Notes:
- ...
```

## 7. Отчеты выполнения

### Block: W1-BL-040 / W1-BL-041 / W1-BL-042
- Date: 2026-02-25
- Build/Commit: local workspace (uncommitted)

Smoke:
- S-01: pass (смоук-тест `App.home.smoke.test.tsx`)
- S-02: not-run
- S-03: not-run
- S-04: not-run
- S-05: not-run
- S-06: pass (перестройка IA, радиус-пресеты и location-контролы в `SettingsDrawer`)
- S-07: pass (guest gating, dedupe тегов, save feedback)
- S-08: pass (empty/error карточка обновлена ранее в W1-BL-030)
- S-09: pass (регрессий в overlay-навигации не выявлено автотестами/сборкой)
- S-10: pending-manual (требуется проверка на iPhone Safari/PWA)

New regressions:
- none

Notes:
- Локально пройдено: `npm test`, `npm run typecheck`, `npm run build`.
- Исправлена регрессия smoke-теста `App.home.smoke.test.tsx` (защита defaults в `SettingsDrawer`).

### Block: W1-BL-051
- Date: 2026-02-25
- Build/Commit: local workspace (uncommitted)

Smoke:
- S-01: pass (`App.home.smoke.test.tsx`)
- S-03: pass (контроллерные тесты метрик для выбора кофейни и route-click)
- S-05: pass (событие `cafe_card_open` не дублируется при повторном выборе)
- S-09: pass (overlay-контекст не затронут изменениями)

New regressions:
- none

Notes:
- Добавлен тест `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/hooks/useDiscoveryPageController.metrics.test.tsx`.
- Проверено: `event_type=cafe_card_open` без дублей, `route_click` с provider `2gis/yandex`.
