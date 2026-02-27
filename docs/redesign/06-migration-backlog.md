# Этап 0: Migration Backlog (Wave 1 + Stack Transition)

Документ переводит спецификации Wave 1 в рабочие задачи разработки.

Связанные документы:
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/00-goals.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/01-practical-ui-rules.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/01a-practical-ui-rubric.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/02-scope-wave1.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/03-definition-of-done.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/screens/discovery.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/screens/discovery-settings.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/08-ui-stack-migration.md`

## 1. Как пользоваться backlog

1. Выполняем задачи сверху вниз по `critical path`.
2. Сроки не фиксируем; приоритет определяется меткой `P0/P1`.
3. Каждая задача закрывается только после проверки критериев приемки (`AC`).
4. Если задача меняет поведение UX, обновляем соответствующий `screens/*.md`.

## 2. Статусы задач

- `todo` — не начато.
- `in_progress` — в работе.
- `blocked` — есть внешний блокер.
- `review` — готово, ожидает проверку.
- `done` — принято по AC.

## 3. Critical Path Wave 1

1. `W1-BL-001` -> 2. `W1-BL-002` -> 3. `W1-BL-003` -> 4. `W1-BL-010` -> 5. `W1-BL-020` -> 6. `W1-BL-030` -> 7. `W1-BL-040` -> 8. `W1-BL-050`

## 4. Backlog задач

### [x] W1-BL-001 · Baseline freeze и контроль регрессий (P0, status: done)
- Цель: зафиксировать исходное поведение главного экрана до редизайна.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/DiscoveryScreen.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/hooks/useDiscoveryPageController.ts`
- AC: список smoke-сценариев Wave 1 записан в документе и подтвержден.
- AC: известные текущие баги отделены от новых регрессий.
- Артефакт: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/07-wave1-baseline-smoke.md`

### [x] W1-BL-002 · UI foundation для Wave 1 (P0, status: done)
- Цель: утвердить единые визуальные примитивы (spacing, radius, elevation, states) под shadcn-like стиль.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/App.css`
- Depends on: `W1-BL-001`
- AC: определены и применимы системные токены для главного экрана.
- AC: нет точечных “магических” отступов/радиусов без системной переменной.
- Артефакт: foundation tokens и utility-классы в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`
- Артефакт: перевод базовых app-стилей на токены в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/App.css`

### [x] W1-BL-003 · Safe-area и viewport hardening (P0, status: done)
- Цель: стабилизировать поведение на iOS Safari/PWA и убрать уезды шапки/контента.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/layout/LayoutMetricsContext.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/DiscoveryScreen.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`
- Depends on: `W1-BL-002`
- AC: header не уезжает под системные зоны.
- AC: при изменении viewport (скролл, клавиатура, смена ориентации) layout остается стабильным.
- Артефакт: robust viewport snapshot + CSS vars sync в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/layout/LayoutMetricsContext.tsx`
- Артефакт: fixed discovery viewport height в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/DiscoveryScreen.tsx`
- Артефакт: global viewport vars и hardening стилей в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/main.tsx`

### [x] W1-BL-010 · Redesign верхней панели Discovery (P0, status: done)
- Цель: собрать компактную иерархичную шапку с очевидными primary/secondary действиями.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.module.css`
- Depends on: `W1-BL-003`
- AC: структура “профиль/избранное/настройки/теги” читается за 1 взгляд.
- AC: верхние теги не перегружают шапку и не ломают ширины на мобильном.
- AC: переходы в `/profile` и `/settings` сохраняют `backgroundLocation`.
- Артефакт: новая header-shell структура и layout-метрики в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.tsx`
- Артефакт: полный рефакторинг стилей верхней панели в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.module.css`

### [x] W1-BL-011 · Полировка верхних тегов и auth-гейтинга (P0, status: done)
- Цель: сделать поведение тегов предсказуемым для гостя и авторизованного пользователя.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Depends on: `W1-BL-010`
- AC: неавторизованный пользователь видит понятное ограничение без “мертвых” действий.
- AC: выбранные пользователем теги не конфликтуют с популярными тегами.
- Артефакт: login-CTA для guest и auth-trigger в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Артефакт: исключение конфликтов popular vs selected tags в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Артефакт: нормализация/дедуп top tags в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/hooks/useDiscoveryPageController.ts`

### [x] W1-BL-020 · BottomSheet shell и state-модель (P0, status: done)
- Цель: стабилизировать и упростить поведение `peek/mid/expanded` без дергания UI.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.module.css`
- Depends on: `W1-BL-003`
- AC: переключение состояний листа предсказуемо на touch/mouse.
- AC: лист не скрывается “слишком рано” при drag вниз.
- AC: horizontal swipe в фото/контенте не ломает drag листа.
- Артефакт: новая snap-логика с гистерезисом и deep-pull threshold в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.tsx`
- Артефакт: shell-hardening (safe-bottom, transitions, drag-surface polish) в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.module.css`

### [x] W1-BL-021 · Header-контент листа и визуальная слоистость (P0, status: done)
- Цель: убрать визуальные артефакты “обрезания” карточек за выбранной кофейней.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.module.css`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeCard.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/cafe-card/CafeCardHero.tsx`
- Depends on: `W1-BL-020`
- AC: выбранная карточка читается как слой над списком.
- AC: элементы списка под карточкой исчезают плавно по заданной зоне fade.
- AC: нет заметного clipping по краям карточек при скролле.
- Артефакт: overlay-fade зоны под выбранной карточкой и выравнивание листа в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.module.css`
- Артефакт: усиление layer/elevation выбранной карточки в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeCard.tsx`

### [x] W1-BL-030 · Редизайн списка кофеен и состояний загрузки (P0, status: done)
- Цель: унифицировать стиль списка, скелетонов и empty/error в рамках Wave 1.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.module.css`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/EmptyStateCard.tsx`
- Depends on: `W1-BL-020`
- AC: loading-state визуально соответствует новому стилю и не дергает layout.
- AC: empty/error-state дает понятный следующий шаг (retry/гео/город).
- AC: отступы и ширина списка согласованы с выбранной карточкой.
- Артефакт: новый style-system для list items + skeleton в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.tsx`
- Артефакт: визуальные токены и состояния списка в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.module.css`
- Артефакт: переработанный empty/error/no-geo card в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/EmptyStateCard.tsx`

### [x] W1-BL-031 · Floating controls и map-overlays (P1, status: done)
- Цель: согласовать кнопки карты с новым UI и устранить шум map-контролов.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.module.css`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`
- Depends on: `W1-BL-030`
- AC: floating-кнопки визуально и размерно согласованы с шапкой/листом.
- AC: служебные map-контролы не засоряют интерфейс и не перекрывают действия.
- Артефакт: синхронизация locate-control с glass-state/active-state в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.tsx`
- Артефакт: позиционирование и desktop-alignment floating control в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.module.css`
- Артефакт: suppression встроенных MapLibre control-container + выравнивание zoom controls в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`

### [x] W1-BL-040 · Redesign Settings Drawer IA (P0, status: done)
- Цель: перестроить настройки в последовательный flow “место -> фильтрация -> контент”.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Depends on: `W1-BL-011`
- AC: пользователь за <=2 шага находит место, радиус, теги.
- AC: группировка блоков соответствует спецификации `discovery-settings.md`.
- AC: отсутствуют прозрачные/некликабельные контролы.
- Артефакт: IA-перестройка блоков `1) место -> 2) фильтрация -> 3) контент` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`

### [x] W1-BL-041 · Redesign Settings Drawer controls (P0, status: done)
- Цель: единый современный стиль `Select/Chip/Button/Radius presets` внутри Drawer.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/styles/glass.ts`
- Depends on: `W1-BL-040`
- AC: радиус по умолчанию `5 км` и управление радиусом работает на мобильных.
- AC: select/чипы читаемы, контрастны, без визуальных сбоев в светлой/темной теме.
- AC: сценарий “гео недоступно -> выбрать город” работает без тупиков.
- Артефакт: унифицированные стили `Select/ActionIcon/Radius presets/Button` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/styles/glass.ts`
- Артефакт: применение unified controls в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`

### [x] W1-BL-042 · Tag picker и top-tags UX (P0, status: done)
- Цель: сделать flow выбора тегов простым и устойчивым.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Depends on: `W1-BL-041`
- AC: исключены дубликаты тегов в UI и отправке.
- AC: поиск существующего тега работает, несуществующий тег не добавляется.
- AC: сохранение дает понятное состояние `saving/success/error`.
- Артефакт: дедуп выбранных/доступных тегов + защита add-only-existing в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Артефакт: feedback `сохранение -> сохранено/ошибка` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`

### [x] W1-BL-050 · Интеграция сценариев и ручной smoke-pack (P0, status: done)
- Цель: подтвердить целостность Wave 1 end-to-end.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/03-definition-of-done.md`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/01a-practical-ui-rubric.md`
- Depends on: `W1-BL-030`, `W1-BL-042`
- AC: пройдены ключевые сценарии Discovery из `screens/discovery.md`.
- AC: каждый измененный экран имеет rubric score >= 17/20.
- AC: критичных ошибок в консоли и падений UI нет.
- Артефакт: Wave 1 smoke-report snapshot в `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/07-wave1-baseline-smoke.md`
- Артефакт: rubric snapshot `19/20` в `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/01a-practical-ui-rubric.md`
- Note: ручной `S-10` (iPhone Safari/PWA) закрыт в продуктовой проверке.

### [x] W1-BL-051 · Метрики и событиевая консистентность (P1, status: done)
- Цель: убедиться, что UX-редизайн не ломает продуктовые события.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/hooks/useDiscoveryPageController.ts`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/DiscoveryScreen.tsx`
- Depends on: `W1-BL-050`
- AC: события `cafe_card_open`, `route_click`, `review_read`, `checkin_start`, `review_submit` не потеряны.
- AC: нет дублей событий из-за нового UI-потока.
- Артефакт: metrics-тесты контроллера Discovery в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/hooks/useDiscoveryPageController.metrics.test.tsx`
- Артефакт: подтверждение test-pack `32/32` в локальном прогоне `vitest`.

### [x] W1-BL-052 · Typecheck, build, release notes Wave 1 (P0, status: done)
- Цель: закрыть инженерный контур и зафиксировать результат.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/`
- Depends on: `W1-BL-050`
- AC: `typecheck` и production build проходят.
- AC: документация Wave 1 обновлена после фактических изменений.
- AC: зафиксирован список открытых рисков перед стартом Wave 2.
- Артефакт: локальные прогоны `npm test`, `npm run typecheck`, `npm run build` — pass.
- Note: закрыто после ручного `S-10` и актуализации release-снимка Wave 1.

## 5. Exit criteria для перехода к Wave 2

1. Все задачи `P0` в состоянии `done`.
2. Стабильны ключевые сценарии:
- `гео -> выбор кофейни -> деталка -> назад`,
- `настройки -> радиус/теги -> обновление выдачи`.
3. iOS Safari/PWA не имеет критичных визуальных багов по safe-area и drag.
4. Wave 1 проходит общий DoD из `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/03-definition-of-done.md`.

## 6. Stack Transition Gate и Critical Path

Запуск трека `STK-BL-*` разрешен только после:
1. `W1-BL-050` = `done`.
2. `W1-BL-052` = `done`.

Critical path stack-transition:
1. `STK-BL-001` -> 2. `STK-BL-002` -> 3. `STK-BL-003` -> 4. `STK-BL-010` -> 5. `STK-BL-020`

## 7. Backlog задач: Stack Transition (`Tailwind + shadcn/ui`)

### [x] STK-BL-001 · Tailwind bootstrap и token bridge (P0, status: done)
- Цель: подключить `Tailwind` без поломки текущего UI.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/` (configs + entry CSS).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`.
- Depends on: `W1-BL-052`.
- AC: `Tailwind` работает в проекте, сборка и typecheck зеленые.
- AC: базовые design tokens проброшены в новый слой утилит.
- AC: существующий экран Discovery визуально не деградировал после bootstrap.
- Артефакт: подключен Tailwind Vite plugin в `/Users/a1/Desktop/Prog/gde-coffee/frontend/vite.config.ts`.
- Артефакт: добавлен token bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/styles/tailwind-bridge.css`.
- Артефакт: Tailwind theme/utilities импортированы в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css` без preflight-reset.

### [x] STK-BL-002 · shadcn/ui infrastructure и базовые примитивы (P0, status: done)
- Цель: завести реальную инфраструктуру `shadcn/ui`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/*`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/lib/*` (утилиты классов и shared helpers).
- Depends on: `STK-BL-001`.
- AC: доступны базовые примитивы (`Button`, `Input`, `Select`/`Popover`, `Sheet`, `Badge`).
- AC: темизация и радиусы согласованы с текущими токенами продукта.
- AC: режим светлой/темной темы сохраняет читаемость и контраст.
- Артефакт: добавлен `cn()` helper в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/lib/utils.ts`.
- Артефакт: добавлены базовые UI-примитивы в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/` (`button.tsx`, `input.tsx`, `badge.tsx`, `sheet.tsx`, `popover.tsx`).
- Артефакт: re-export layer в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/index.ts`.

### [x] STK-BL-003 · Coexistence-правила Mantine + shadcn (P0, status: done)
- Цель: формализовать переходный режим, чтобы не получить хаос из двух UI-систем.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/08-ui-stack-migration.md`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/` (точки интеграции и адаптеры).
- Depends on: `STK-BL-002`.
- AC: зафиксированы правила “что новое делаем на shadcn, что временно остается на Mantine”.
- AC: нет дублирующих компонентных контрактов без явной причины.
- AC: типовые UI-контейнеры (модалка/лист/форма) имеют утвержденный путь миграции.
- Артефакт: правила coexistence и migration-path добавлены в `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/08-ui-stack-migration.md` (раздел 7).
- Артефакт: bridge-контракты контейнеров и форм добавлены в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/form.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts`.
- Артефакт: guardrail для `src/components/ui/*` добавлен в `/Users/a1/Desktop/Prog/gde-coffee/frontend/eslint.config.js` (`no-restricted-imports` для `@mantine/core`).

### [x] STK-BL-010 · Пилотная миграция: Discovery Settings на новом стеке (P0, status: done)
- Цель: проверить подход на реальном критичном сценарии.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`.
- Depends on: `STK-BL-003`.
- AC: `SettingsDrawer` переведен на новый стек без потери UX-функций.
- AC: сценарии радиуса/города/тегов проходят без регрессий.
- AC: консоль без критичных ошибок, typecheck/build проходят.
- Прогресс: контейнер `SettingsDrawer` переведен на bridge + Radix sheet; actions/chips/form-layout в `SettingsDrawer` переведены на новый UI-слой.
- Артефакт: bridge-container migration и UI-controls migration в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx` через `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/form.tsx`.
- Артефакт: селекты экрана переведены на bridge-контракт `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/select.tsx`.
- Примечание: `Select` пока остается Mantine как legacy-control переходного этапа (по правилам `STK-BL-003`).
- Проверка: `npm test`, `npm run typecheck`, `npm run build` — pass.

### [x] STK-BL-020 · План масштабирования на Wave 2/3 и deprecation legacy UI (P1, status: done)
- Цель: зафиксировать управляемый массовый перенос экранов.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/02-scope-wave1.md`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/08-ui-stack-migration.md`.
- Depends on: `STK-BL-010`.
- AC: определен порядок миграции экранов Wave 2/3 на новом стеке.
- AC: есть явные критерии отключения legacy Mantine-слоя.
- AC: исключены “подвешенные” зоны со смешанными и неунифицированными паттернами.
- Артефакт: порядок миграции Wave 2/3 и exit-критерии волн добавлены в `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/02-scope-wave1.md`.
- Артефакт: formal deprecation plan для Mantine (Stage A-D) и правила масштабирования добавлены в `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/08-ui-stack-migration.md`.

## 8. Wave 2 Execution Queue (New UI)

### [x] W2-A · Cafe details shell/layout/tabs/top-actions migration (P0, status: done)
- Цель: перенести shell карточки кофейни на новый UI-слой без изменения бизнес-логики вкладок.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/CafeDetailsScreen.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx`.
- AC: контейнер деталки использует bridge-контракт нового слоя.
- AC: top-actions и tabs не зависят от Mantine SegmentedControl/Modal.
- AC: about/menu/reviews сценарии и открытие lightbox работают без регрессий.
- Артефакт: `CafeDetailsScreen` переведен на `AppModal` + new-ui tabs/actions в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/CafeDetailsScreen.tsx`.
- Артефакт: `AppModal` bridge расширен для full-screen radix-модели в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx`.
- Проверка: `npm test`, `npm run typecheck`, `npm run build` — pass.

### [x] W2-B · About/Menu photo blocks + lightbox migration (P0, status: done)
- Цель: перенести фото-flow деталки (`AboutSection`, `MenuSection`, lightbox) на новый UI-слой без деградации сценариев.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/AboutSection.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/MenuSection.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/PhotoLightboxModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx`.
- Depends on: `W2-A`.
- AC: основные фото-блоки вкладок `О месте/Меню` не используют ad-hoc Mantine layout primitives.
- AC: лайтбокс открывается в новом bridge-контейнере и поддерживает свайп/кнопки/миниатюры.
- AC: CTA добавления первого фото и добавления фото в обеих вкладках визуально и поведенчески согласованы.
- Артефакт: `AboutSection` переведен на `components/ui` + нативные layout controls в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/AboutSection.tsx`.
- Артефакт: `MenuSection` переведен на `components/ui` + унифицированные photo-strip/tag-strip controls в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/MenuSection.tsx`.
- Артефакт: `PhotoLightboxModal` переведен на `AppModal` (`presentation="dialog"`) без Mantine layout wrappers в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/PhotoLightboxModal.tsx`.
- Проверка: `npm run typecheck`, `npm test`, `npm run build` — pass.

### [x] W2-C · Reviews/composer/feed controls migration (P0, status: done)
- Цель: перевести reviews-flow деталки на новый UI-слой поэтапно, без регрессий в создании/чтении отзывов.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/ReviewsSection.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewComposerCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewFeed.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/tags-input.tsx`.
- Depends on: `W2-B`.
- AC: sticky CTA и collapse/expand композера работают на новом UI-паттерне.
- AC: feed controls (sort/filter/load-more/modal) переведены на bridge/new-ui без потери сценариев.
- AC: composer controls (rating/tags/photos/submit) переведены на единый new-ui паттерн.
- Артефакт: `ReviewsSection` переведен с Mantine `Stack/Collapse/ActionIcon` на `motion + components/ui/Button` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/ReviewsSection.tsx`.
- Артефакт: `ReviewFeed` переведен на `AppSelect` + `AppModal` + new-ui cards/buttons/skeleton в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewFeed.tsx`.
- Артефакт: `ReviewComposerCard` переведен на new-ui controls с bridge для тегового инпута в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewComposerCard.tsx`.
- Артефакт: добавлен `AppTagsInput` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/tags-input.tsx` и экспорт в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts`.
- Проверка: `npm run typecheck`, `npm test`, `npm run build` — pass.

## 9. Wave 3 Execution Queue (New UI)

### [x] W3-A · Profile shell + key cards/CTA migration (P0, status: done)
- Цель: перевести `/profile` на new-ui слой, сохранить бизнес-логику профиля и упростить визуальный шум.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ProfileScreen.tsx`.
- Depends on: `W2-C`.
- AC: shell профиля (header/hero/key-actions) не зависит от Mantine UI primitives.
- AC: ключевые сценарии профиля (имя, фото, level/progress, соцсети, logout) сохранены.
- AC: приватные данные скрыты по умолчанию и раскрываются контролируемо.
- Артефакт: `ProfileScreen` переписан на `components/ui` + utility layout, удалены ad-hoc placeholder-блоки.
- Проверка: `npm run typecheck`, `npm test`, `npm run build` — pass.

### [x] W3-B · Settings forms + account actions migration (P0, status: done)
- Цель: перевести `/settings` пользовательские формы и account actions на единый new-ui/bridge паттерн.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.tsx`.
- Depends on: `W3-A`.
- AC: пользовательские формы (`verify email`, `email change`, `password reset`, `feedback`) используют единый new-ui pattern.
- AC: role-gated moderator/admin блоки внутри `/settings` (навигация, versioning, health, DLQ) переведены на единый new-ui action/panel pattern.
- AC: `/settings` shell (header/actions/container/forms) не зависит от Mantine layout primitives (`Box/Group/Stack/Text/Title`).
- AC: UX и валидации форм сохранены без регрессий.
- Артефакт: миграция пользовательских форм + moderator/admin панелей в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.tsx`.
- Артефакт: shell/panel/form styles в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.module.css`.
- Проверка: `npm run typecheck`, `npm test`, `npm run build` — pass.

### [x] W3-C · Profile/Settings final polish + legacy shrink (P1, status: done)
- Цель: закрыть остаточные mixed-pattern зоны Profile/Settings и подготовить deprecation legacy UI в Wave 3.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ProfileScreen.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.tsx`.
- Depends on: `W3-B`.
- AC: из `/profile` убраны остаточные mixed-pattern фрагменты (inline-редактирование имени/соцсети), экран сфокусирован на hero + уровень + key-actions.
- AC: профильные изменения данных консолидированы в `/settings` в единый блок `Смена данных` (имя + email + пароль).
- AC: в профильном слое убран неиспользуемый legacy state/API-код, который не влияет на текущий UX.
- AC: `/settings` и drawer-настройки приведены к “плоскому” стилю без лишних визуальных контейнеров/нумерованных секций.
- Артефакт: упрощение profile account hook и удаление неиспользуемых профильных стилей в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/profile/model/useProfileAccount.ts`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ProfileScreen.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ProfileScreen.module.css`.
- Артефакт: финальная полировка settings-flow и консолидация форм в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.module.css`.
- Артефакт: flatten-полировка drawer-настроек в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`.
- Проверка: `npm run typecheck`, `npm test`, `npm run build` — pass.

## 10. Wave 4 Execution Queue (Stage C Legacy Shrink)

### [x] W4-A · Discovery shell/card de-Mantine bootstrap (P1, status: done)
- Цель: открыть Stage C практической задачей и начать сокращение прямых импортов `@mantine/core` в ключевом пользовательском Discovery-потоке.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/DiscoveryScreen.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/cafe-card/CafeCardFooter.tsx`.
- Depends on: `W3-C`.
- AC: root shell `/` не использует Mantine `Box`, layout построен на нативных контейнерах.
- AC: выбранная карточка кофейни (`CafeCard`) не зависит от Mantine `Paper`.
- AC: footer выбранной карточки (`CafeCardFooter`) не зависит от Mantine `Box/Group/Text/Badge`.
- Артефакт: de-Mantine shell/layout в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/DiscoveryScreen.tsx`.
- Артефакт: de-Mantine container карточки в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeCard.tsx`.
- Артефакт: de-Mantine footer карточки и переход на `components/ui/Badge` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/cafe-card/CafeCardFooter.tsx`.
- Проверка: `npm run typecheck`, `npm run build` — pass.

### [x] W4-B · Discovery list/controls de-Mantine (P1, status: done)
- Цель: продолжить Stage C и снять прямые зависимости от Mantine в базовых list/control контейнерах Discovery.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.tsx`.
- Depends on: `W4-A`.
- AC: `CafeList` не использует Mantine `Stack/Group/Box/Text/UnstyledButton`.
- AC: `FloatingControls` не использует Mantine `ActionIcon/Box`, включая loading-состояние кнопки.
- AC: `FiltersBar` не использует Mantine `ActionIcon/Box/Text/UnstyledButton`.
- AC: `BottomSheet` не использует Mantine `Box/Paper/Text`, сохраняя текущую drag/snap механику.
- Артефакт: de-Mantine list row/skeleton layout в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.module.css`.
- Артефакт: de-Mantine floating locate control в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.module.css`.
- Артефакт: de-Mantine top controls bar в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.tsx`.
- Артефакт: de-Mantine bottom sheet shell/container в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.tsx`.
- Проверка: `npm run typecheck`, `npm run build` — pass.

### [x] W4-C · Discovery location choice flow de-Mantine (P1, status: done)
- Цель: убрать прямые зависимости `@mantine/core` из header/overlay/empty-state сценариев выбора локации и пустого состояния на главном экране.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/EmptyStateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/sheet/DiscoveryLocationChoiceHeader.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/sheet/DiscoveryManualPickHeader.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/map/ManualPickOverlay.tsx`.
- Depends on: `W4-B`.
- AC: `EmptyStateCard` не использует Mantine `Paper/Stack/Text/Button/ThemeIcon/ActionIcon/Select`.
- AC: `DiscoveryLocationChoiceHeader` и `DiscoveryManualPickHeader` не используют Mantine `Paper/Stack/Text/Button/Select`.
- AC: `ManualPickOverlay` не использует Mantine `Box/Group/Button`.
- AC: select-контракты сохранены через bridge (`AppSelect`) без изменения сценариев выбора города.
- Артефакт: de-Mantine empty state + style module в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/EmptyStateCard.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/EmptyStateCard.module.css`.
- Артефакт: de-Mantine location headers в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/sheet/DiscoveryLocationChoiceHeader.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/sheet/DiscoveryLocationChoiceHeader.module.css`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/sheet/DiscoveryManualPickHeader.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/sheet/DiscoveryManualPickHeader.module.css`.
- Артефакт: de-Mantine manual-pick overlay в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/map/ManualPickOverlay.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/map/ManualPickOverlay.module.css`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W4-D · Discovery hero + rating diagnostics de-Mantine (P1, status: done)
- Цель: снять прямые зависимости `@mantine/core` в выбранной карточке (hero) и в блоках диагностики рейтинга внутри деталки.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/cafe-card/CafeCardHero.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/RatingPanel.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/AdminDiagnosticsPanel.tsx`.
- Depends on: `W4-C`.
- AC: `CafeCardHero` не использует Mantine `Box/Stack/Group/Button/Badge`, включая route-кнопки, distance-бейдж и photo-indicators.
- AC: `RatingPanel` не использует Mantine `Badge/Group/Paper/Stack/Text`, сохраняя логику чипов рейтинга, лучшего отзыва и перехода к отзывам.
- AC: `AdminDiagnosticsPanel` не использует Mantine `Badge/Button/Group/Paper/Stack/Text`, сохраняя все метрики, AI-поля и top-reviews list.
- Артефакт: de-Mantine hero + style module в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/cafe-card/CafeCardHero.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/cafe-card/CafeCardHero.module.css`.
- Артефакт: de-Mantine rating panel + style module в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/RatingPanel.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/RatingPanel.module.css`.
- Артефакт: de-Mantine admin diagnostics panel + style module в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/AdminDiagnosticsPanel.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/sections/AdminDiagnosticsPanel.module.css`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.
