# Этап 0: План Миграции UI-Стека (`Tailwind + shadcn/ui`)

Документ фиксирует, когда и как мы переходим с текущего UI-слоя на новый стек.

## 1. Зачем этот этап
1. Перевести визуальную систему из режима “shadcn-like” в реальный стек `Tailwind + shadcn/ui`.
2. Сохранить скорость разработки и избежать хаотичного смешения подходов.
3. Обеспечить предсказуемый переход без массовых регрессий.

## 2. Gate запуска этапа
Миграция стека начинается только после выполнения обоих условий:
1. `W1-BL-050` в статусе `done`.
2. `W1-BL-052` в статусе `done`.

Рабочий backlog этапа:
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/06-migration-backlog.md` (блок `STK-BL-*`).

Статус на `2026-02-27`:
1. Gate выполнен (`W1-BL-050` и `W1-BL-052` закрыты).
2. `STK-BL-001`, `STK-BL-002`, `STK-BL-003`, `STK-BL-010`, `STK-BL-020` закрыты.
3. Следующий практический трек: реализация Wave 2 (`W2-A` -> `W2-B` -> `W2-C`) по правилам раздела 8.
4. `W2-A` и `W2-B` закрыты (`done`).
5. `W2-C` закрыт (`done`): reviews/composer/feed переведены на new-ui/bridge контракты.
6. `W3-A` закрыт (`done`): profile shell + key cards/CTA переведены на new-ui слой.
7. `W3-B` закрыт (`done`): settings shell + user forms + role-gated moderator/admin panels переведены на new-ui pattern.
8. `W3-C` закрыт (`done`): Profile/Settings доведены до финального UX-polish, mixed-pattern зоны убраны, профильный legacy-код сокращен.
9. `W4-A` закрыт (`done`): Stage C открыт через de-Mantine bootstrap для Discovery shell/card/footer.
10. `W4-B` закрыт (`done`): de-Mantine migration для Discovery list/controls (`CafeList`, `FloatingControls`, `FiltersBar`, `BottomSheet`).
11. `W4-C` закрыт (`done`): de-Mantine migration для location-choice/empty-state flow (`EmptyStateCard`, `DiscoveryLocationChoiceHeader`, `DiscoveryManualPickHeader`, `ManualPickOverlay`).
12. `W4-D` закрыт (`done`): de-Mantine migration для selected-card hero и rating/admin-diagnostics panels (`CafeCardHero`, `RatingPanel`, `AdminDiagnosticsPanel`).
13. `W4-E` закрыт (`done`): de-Mantine migration для photo/proposal модалок (`CafePhotoSubmissionModal`, `CafePhotoAdminModal`, `CafeProposalModal`).
14. `W5-A` закрыт (`done`): de-Mantine migration для user shell/auth/account flow (`AuthGate`, `LoginPage`, `VerifyEmailPage`, `ConfirmEmailChangePage`, `ResetPasswordPage`, `FavoritesPage`, `SettingsScreen` theme hook usage).
15. `W5-B` закрыт (`done`): de-Mantine cleanup shared user-layer (`Map`, `ColorSchemeToggle`, `ui/bridge/overlay` Radix-only runtime path).
16. `W5-C` закрыт (`done`): de-Mantine migration для bridge input layer (`AppSelect`, `AppTagsInput`) и legacy `WorkScreen/features/work` потока.

## 3. Принципы миграции
1. Без big-bang: переносим слой поэтапно, зона за зоной.
2. Сначала платформа и примитивы, затем экраны.
3. На переходный период разрешено сосуществование `Mantine + shadcn`.
4. Новые компоненты редизайна по возможности делаем сразу на новом стеке.

## 4. Порядок работ (критический путь)
1. `STK-BL-001` — bootstrap `Tailwind` + bridge к существующим токенам.
2. `STK-BL-002` — инфраструктура `shadcn/ui` и базовые примитивы.
3. `STK-BL-003` — правила coexistence и адаптеры для текущих экранов.
4. `STK-BL-010` — пилотная миграция одной зоны (настройки discovery).
5. `STK-BL-020` — решение по масштабированию на Wave 2/3 и план деактивации legacy UI.

## 5. Операционный протокол “следующий шаг”
Если пользователь просит “давай следующий шаг”, порядок такой:
1. Пока gate из раздела 2 не выполнен: продолжаем `W1-BL-*` задачи.
2. Как только gate выполнен: следующей задачей автоматически становится `STK-BL-001`.
3. Далее двигаемся строго по порядку `STK-BL-*` критического пути.

## 6. Критерии завершения этапа
1. В проекте есть рабочая `Tailwind`-конфигурация и `shadcn/ui`-слой.
2. Пилотная зона на новом стеке проходит `typecheck`, build и smoke.
3. Зафиксирован план массового переноса экранов и отключения legacy-компонентов.

## 7. Coexistence Rules (`STK-BL-003`)

### 7.1 Source of truth по новым UI-компонентам
1. Новый reusable UI создается в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/*` (Radix + Tailwind).
2. Внутри `src/components/ui/*` прямые импорты `@mantine/core` запрещены (ESLint guardrail).
3. Mantine остается только как legacy-слой для уже существующих экранов и сценариев, пока они не мигрированы.

### 7.2 Где допускается Mantine
1. Текущие экраны (`features/*`, `pages/*`) до их целевой миграции.
2. Глобальные интеграции `MantineProvider`, `Notifications`, текущая тема.
3. Временный bridge-слой `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/*`, где согласованы интерфейсы перехода.

### 7.3 Где обязателен shadcn/Tailwind
1. Любые новые базовые primitives (кнопка, input, badge, sheet/popover).
2. Новые “дизайн-системные” компоненты, рассчитанные на reuse.
3. Новый код в пилотной зоне после старта `STK-BL-010`.

### 7.4 Утвержденные migration-path для контейнеров
1. Modal path: `Mantine Modal` -> `AppModal` bridge (`src/ui/bridge/overlay.tsx`) -> Radix-backed реализация.
2. Sheet/Drawer path: `Mantine Drawer` -> `AppSheet` bridge (`src/ui/bridge/overlay.tsx`) -> `components/ui/sheet.tsx`.
3. Form path: Mantine-form layout -> `FormField/FormActions` bridge (`src/ui/bridge/form.tsx`) + `components/ui/input.tsx`/`components/ui/popover.tsx`.

### 7.5 Правило PR-приемки для переходного периода
1. Нельзя добавлять новый reusable UI поверх Mantine, если уже есть эквивалент в `src/components/ui`.
2. Если временно нужен Mantine-контейнер, он должен идти через bridge-слой.
3. Для каждого PR в миграционном треке явно указывать: `legacy`, `bridge`, или `new-ui`.

## 8. Масштабирование на Wave 2/3 (`STK-BL-020`)

### 8.1 Очередность миграции зон
1. Wave 2 (деталка + фото):
   - `W2-A`: shell + layout + tabs + top actions.
   - `W2-B`: photo blocks/lightbox/menu-photo flow.
   - `W2-C`: reviews/composer/feed controls.
2. Wave 3 (профиль + настройки профиля):
   - `W3-A`: profile shell + ключевые карточки и CTA.
   - `W3-B`: settings forms и account actions.
   - `W3-C`: финальная UX-полировка и снятие mixed-pattern зон.

### 8.2 Правило “завершить подзону до следующей”
1. Подзона считается закрытой только после `test + typecheck + build + smoke`.
2. Нельзя мигрировать следующую подзону, если в предыдущей есть открытые `P0` регрессии.
3. Для каждой подзоны фиксируется артефакт-обновление в backlog (`06-migration-backlog.md`).

### 8.3 Допустимый legacy-периметр по этапам
1. Wave 2: Mantine допустим только как bridge backend для Select/Modal/Drawer, без прямого ad-hoc UI в новых компонентах зоны.
2. Wave 3: прямой Mantine в профильных экранах только в явно отмеченных legacy-файлах, которые стоят в очереди миграции текущей подволны.
3. После Wave 3: legacy Mantine разрешен только в глобальных провайдерах и не мигрированных admin-зонах.

## 9. Критерии deprecation legacy Mantine

### 9.1 Stage A — Freeze
1. Запрещены новые reusable-компоненты на Mantine.
2. Все новые reusable UI идут в `src/components/ui/*`.
3. Все переходные контейнеры идут через `src/ui/bridge/*`.

### 9.2 Stage B — Scope Exit (per wave)
1. В закрытой волне нет прямых импортов `@mantine/core` в мигрированных feature-файлах.
2. Все container/form/select точки волны сидят на bridge-контрактах или новом UI.
3. UX smoke-пакет волны проходит без регрессий.

### 9.3 Stage C — Global Legacy Shrink
1. Mantine остается только в:
   - `MantineProvider` и `Notifications`,
   - явно не мигрированных admin-экранах.
2. Для пользовательских экранов (`/`, деталка, профиль, настройки профиля) Mantine удален из прямых зависимостей UI-слоя.
3. Bridge-слой содержит полный контракт, достаточный для отказа от прямых Mantine-компонентов в продуктовых зонах.

### 9.4 Stage D — Removal Readiness
1. Нет runtime-зависимости пользовательских сценариев от Mantine UI-компонентов.
2. Есть подтвержденный план миграции admin-зон или решение оставить их изолированными до отдельной волны.
3. После выполнения пунктов 1-2 можно планировать отдельный этап удаления Mantine-пакетов.
