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

### [x] W4-E · Discovery photo/proposal modals de-Mantine (P1, status: done)
- Цель: убрать прямые зависимости `@mantine/core` из ключевых full-screen модалок загрузки фото и предложения новой кофейни.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoSubmissionModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoAdminModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/modals/CafeProposalModal.tsx`.
- Depends on: `W4-D`.
- AC: `CafePhotoSubmissionModal` не использует Mantine `Modal/Stack/Group/Box/Text/Button/Badge/ActionIcon/Skeleton`.
- AC: `CafePhotoAdminModal` не использует Mantine `Modal/Stack/Group/Box/Text/Button/Badge/ActionIcon/Skeleton`.
- AC: `CafeProposalModal` не использует Mantine `Modal/Paper/Stack/Group/Box/Text/TextInput/Textarea/Button/Badge/ActionIcon`.
- AC: full-screen UX и сценарии (upload/reorder/cover/delete/geocode/map-pick/submit) сохранены без регрессий.
- Артефакт: de-Mantine photo submission modal + styles в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoSubmissionModal.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoSubmissionModal.module.css`.
- Артефакт: de-Mantine photo admin modal + styles в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoAdminModal.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoAdminModal.module.css`.
- Артефакт: de-Mantine cafe proposal modal + map picker + styles в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/modals/CafeProposalModal.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/modals/CafeProposalModal.module.css`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-A · User shell/auth/account de-Mantine (P1, status: done)
- Цель: убрать прямые импорты `@mantine/core` из пользовательского auth/account контура (login/confirm/reset/favorites/auth-modal/settings theme usage).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/AuthGate.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/LoginPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/VerifyEmailPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ConfirmEmailChangePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ResetPasswordPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/FavoritesPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.tsx`.
- Depends on: `W4-E`.
- AC: auth modal работает через `AppModal` (`implementation="radix"`) + `components/ui` controls, без прямого Mantine UI.
- AC: `/login`, `/verify-email`, `/confirm-email-change`, `/reset-password`, `/favorites` используют нативный layout + `components/ui`, без Mantine UI primitives.
- AC: `SettingsScreen` не импортирует Mantine напрямую; theme control работает через локальный app-hook.
- Артефакт: de-Mantine auth modal + styles в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/AuthGate.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/AuthGate.module.css`.
- Артефакт: de-Mantine auth/account pages + styles в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/LoginPage.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/VerifyEmailPage.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ConfirmEmailChangePage.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ResetPasswordPage.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/FavoritesPage.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/FavoritesPage.module.css`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/LoginPage.module.css`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/ConfirmPage.module.css`.
- Артефакт: theme hook abstraction в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/hooks/useAppColorScheme.ts` и применение в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-B · Shared user-layer de-Mantine cleanup (P1, status: done)
- Цель: дочистить shared пользовательский слой от прямых импортов Mantine и закрепить Radix-only runtime path для overlay-bridge.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/Map.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ColorSchemeToggle.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx`.
- Depends on: `W5-A`.
- AC: `Map` больше не импортирует `@mantine/core`; color-scheme берется через app theme-hook.
- AC: `ColorSchemeToggle` использует `components/ui/Button`, без Mantine `ActionIcon`.
- AC: `AppModal`/`AppSheet` не имеют runtime fallback на Mantine (`overlay` bridge работает через Radix path), API-совместимость вызовов сохранена.
- Артефакт: de-Mantine map theme usage в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/Map.tsx`.
- Артефакт: de-Mantine color toggle control в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ColorSchemeToggle.tsx`.
- Артефакт: Radix-only overlay bridge runtime в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-C · Bridge inputs + legacy work-flow de-Mantine (P1, status: done)
- Цель: убрать remaining Mantine из bridge input-контрактов и legacy work flow, сохранив рабочие пользовательские сценарии фильтрации/навигации/отзывов.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/select.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/tags-input.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/WorkScreen.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/BottomSheet.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/CafeCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/CafeList.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/FloatingControls.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/FiltersBar.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/SettingsDrawer.tsx`.
- Depends on: `W5-B`.
- AC: `AppSelect` работает без Mantine runtime и поддерживает текущие сценарии (`searchable`, `clearable`, `searchValue/onSearchChange`, placeholder, option pick).
- AC: `AppTagsInput` работает без Mantine runtime и поддерживает текущие сценарии (`value/onChange`, suggestions, split chars, max tags, clearable).
- AC: `WorkScreen` и `features/work/components/*` не используют `@mantine/core`.
- Артефакт: Radix/native bridge select in `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/select.tsx`.
- Артефакт: Radix/native bridge tags input in `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/tags-input.tsx`.
- Артефакт: de-Mantine legacy work flow in `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/WorkScreen.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/*`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-D · Admin surfaces de-Mantine (P1, status: done)
- Цель: убрать прямые импорты `@mantine/core` из admin/moderation/metrics/feedback/administrative drinks UI, сохранив текущую UX-логику.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/compat/core.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/*.tsx`.
- Depends on: `W5-C`.
- AC: перечисленные admin-файлы не импортируют `@mantine/core`.
- AC: compat-слой покрывает используемые admin-контракты (`Box` ref, `Button` component/spacing, `Table` colSpan, `Select/Switch/Alert`).
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: расширенный compat UI-layer в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/compat/core.tsx`.
- Артефакт: de-Mantine admin pages в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/Admin*.tsx`.
- Артефакт: de-Mantine admin drinks cards в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/*.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-E · Global shell/theme/notifications de-Mantine (P1, status: done)
- Цель: убрать последние runtime-зависимости `@mantine/core/@mantine/notifications` из пользовательского старта приложения.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/main.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/hooks/useAppColorScheme.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/lib/notifications.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/App.home.smoke.test.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/Admin*.tsx` и discovery/auth files с `notifications.show(...)`.
- Depends on: `W5-D`.
- AC: в `frontend/src` отсутствуют импорты `@mantine/core` и `@mantine/notifications`.
- AC: color scheme работает через локальный app-provider (`data-mantine-color-scheme` сохраняется для CSS-совместимости).
- AC: уведомления работают через локальный `notifications` store + viewport без Mantine provider.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: de-Mantine app shell bootstrap в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/main.tsx`.
- Артефакт: app color-scheme provider/hook в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/hooks/useAppColorScheme.ts`.
- Артефакт: локальная система уведомлений в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/lib/notifications.tsx`.
- Артефакт: import migration `notifications.show(...)` в `frontend/src`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-F · Remove Mantine packages from dependency graph (P1, status: done)
- Цель: физически удалить `@mantine/*` пакеты из frontend dependency graph после полной миграции кода.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/package.json`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/package-lock.json`.
- Depends on: `W5-E`.
- AC: в `frontend/src` нет импортов `@mantine/core` и `@mantine/notifications`.
- AC: в `frontend/package.json` отсутствуют `@mantine/core`, `@mantine/form`, `@mantine/hooks`, `@mantine/modals`, `@mantine/notifications`.
- AC: `npm install` graph не содержит `@mantine/*`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: обновленный dependency set в `/Users/a1/Desktop/Prog/gde-coffee/frontend/package.json`.
- Артефакт: обновленный lockfile без Mantine в `/Users/a1/Desktop/Prog/gde-coffee/frontend/package-lock.json`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-G · Theme attribute neutralization (`data-theme`) (P1, status: done)
- Цель: убрать legacy-привязку темы к `data-mantine-color-scheme` и перейти на нейтральный атрибут `data-theme`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/hooks/useAppColorScheme.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/SettingsScreen.module.css`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/components/FiltersBar.module.css`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.module.css`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.module.css`.
- Depends on: `W5-F`.
- AC: в `frontend/src` отсутствуют упоминания `data-mantine-color-scheme`.
- AC: provider темы выставляет `data-theme="light|dark"` на `documentElement`.
- AC: dark-theme селекторы работают через `data-theme`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: app theme provider с `data-theme` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/hooks/useAppColorScheme.ts`.
- Артефакт: обновленные dark-mode CSS selectors в перечисленных style-файлах.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-H · Remove legacy `features/work` flow (P1, status: done)
- Цель: удалить неиспользуемый legacy flow (`WorkScreen` + `features/work`) после завершения пользовательского редизайна Discovery.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/WorkScreen.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/work/**`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/types.ts`.
- Depends on: `W5-G`.
- AC: в `frontend/src` отсутствуют ссылки на `features/work` и `WorkScreen`.
- AC: общий экспорт типов (`types.ts`) не зависит от legacy work layer.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удален legacy flow (`frontend/src/pages/WorkScreen.tsx`, `frontend/src/features/work/**`).
- Артефакт: `frontend/src/types.ts` переключен на `entities/cafe/model/types`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-I · Shrink `ui/compat` to admin-only minimal contract (P1, status: done)
- Цель: уменьшить и упростить legacy compatibility-layer, оставив только API, реально используемый admin-экранами.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/compat/core.tsx`.
- Depends on: `W5-H`.
- AC: `ui/compat/core.tsx` содержит только минимальные admin primitives (`Box`, `Container`, `Group`, `Stack`, `Paper`, `Text`, `Title`, `Badge`, `Loader`, `Button`, `ActionIcon`, `SegmentedControl`, `Select`, `Switch`, `TextInput`, `Textarea`, `Alert`, `Table`).
- AC: удалены избыточные ветки/пропсы legacy-layer, не влияющие на текущий admin UX.
- AC: все admin-страницы и admin-drinks карточки продолжают собираться и работать на этом контракте.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: переписанный compact compat-core в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/compat/core.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-J · Remove `ui/compat` and move admin to local admin primitives (P1, status: done)
- Цель: убрать legacy `ui/compat` слой и перевести admin-экраны на локальный admin UI-layer, основанный на `components/ui` + `AppSelect`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/primitives.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/Admin*.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/*.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/compat/core.tsx` (delete).
- Depends on: `W5-I`.
- AC: в коде нет импортов `ui/compat/core`.
- AC: admin pages и admin-drinks cards импортируют primitives из `features/admin/ui/primitives`.
- AC: `ui/compat/core.tsx` удален.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: admin-local primitives layer в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/primitives.tsx`.
- Артефакт: import migration `Admin*.tsx` и `features/admin-drinks/ui/*.tsx` на новый путь.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-K · Split admin UI layer and drop `primitives.tsx` (P1, status: done)
- Цель: убрать монолитный admin `primitives` файл и перейти на явные модули `layout/fields` с прямой опорой на `components/ui`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/index.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/primitives.tsx` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/Admin*.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/*.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/button.tsx`.
- Depends on: `W5-J`.
- AC: в `frontend/src` отсутствуют импорты `features/admin/ui/primitives`.
- AC: admin pages/cards импортируют из `features/admin/ui` (barrel `layout + fields`).
- AC: `Button` покрывает admin-совместимые пропсы (`loading`, `leftSection`, `fullWidth`, `component`, `color`, `mt/mb`).
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: разнесенный admin UI-layer (`layout.tsx`, `fields.tsx`, `index.ts`) в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/`.
- Артефакт: удален `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/primitives.tsx`.
- Артефакт: совместимый `Button` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/button.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-L · Isolate admin button compatibility from core `components/ui/button` (P1, status: done)
- Цель: убрать admin-совместимые расширения из общего `components/ui/button` и локализовать их в admin UI-layer.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/button.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Depends on: `W5-K`.
- AC: `components/ui/button.tsx` содержит только базовый шадкн-контракт (`asChild`, базовые variants/sizes) без admin-специфичных props (`loading`, `leftSection`, `component`, `fullWidth`, `mt/mb`, `color`).
- AC: admin pages/cards сохраняют поведение через локальный wrapper `features/admin/ui/layout.tsx::Button`.
- AC: `ActionIcon` в admin UI-layer не использует несуществующие пропсы базового `Button`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: строгий базовый `Button` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/button.tsx`.
- Артефакт: admin-совместимый wrapper `Button` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-M · Remove legacy admin button usage patterns from admin pages/cards (P1, status: done)
- Цель: убрать из admin-экранов legacy-использование кнопки (`light/subtle/xs/component/color/leftSection/fullWidth/mt`) и перейти на нативный контракт `default|secondary|ghost|outline|destructive`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Depends on: `W5-L`.
- AC: в перечисленных admin-файлах отсутствуют legacy-пропсы `Button` (`variant="light|subtle|filled"`, `size="xs"`, `component`, `leftSection`, `fullWidth`, `color`, `mt/mb`).
- AC: загрузка файла JSON в admin import продолжает работать без `component="label"` (через hidden file input + trigger button).
- AC: admin `Button` wrapper в `layout.tsx` поддерживает только актуальный контракт (`variant`, `size`, `loading`) и не содержит legacy-веток.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: migration admin button usage в перечисленных `Admin*.tsx` + `admin-drinks` карточках.
- Артефакт: упрощенный admin button wrapper в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-N · Normalize admin `Badge/Alert/SegmentedControl` contracts and usage (P1, status: done)
- Цель: убрать legacy-паттерны (`light/filled`, `fullWidth`) из admin usage и сузить контракты в admin layout-слое до актуального API.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-M`.
- AC: `Badge` usage в admin файлах переведен на `default|secondary|outline|dot` (без `variant="light|filled"`).
- AC: `Alert` usage в admin файлах не использует `variant` (базовый light-style по умолчанию).
- AC: `SegmentedControl` usage не использует `fullWidth`; ширина управляется стилями root.
- AC: `layout.tsx` не содержит legacy-контракты `Badge variant="light|filled"`, `Alert variant`, `SegmentedControl fullWidth`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: обновленные контракты `Badge/Alert/SegmentedControl` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: import/manage/moderation/north-star/admin-drinks usage migration на новый контракт.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-O · Remove `Group.grow`, `Text.mt/mb`, `Box.pos/*` compat from admin layout layer (P1, status: done)
- Цель: убрать дополнительные mantine-like совместимости в layout-примитивах и перейти на явную верстку через `Box style/className` в admin-экранах.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Depends on: `W5-N`.
- AC: в admin usage отсутствуют `Group grow`, `Text mt/mb`, `Box pos/*` пропсы.
- AC: `layout.tsx` не содержит `Group.grow` ветку, `Text.mt/mb`, `Box.pos/left/right/top/bottom/inset`.
- AC: layout эквивалентен по поведению (двухколоночные группы реализованы через `Box` wrappers с `flex:1`).
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенные `Box/Group/Text` контракты в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: explicit-layout migration в перечисленных `Admin*.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-P · Remove remaining spacing aliases (`mt/mb`) from admin layout/fields layer (P1, status: done)
- Цель: убрать последние spacing-алиасы (`mt/mb`) из admin bridge-примитивов и использовать явные `style/className` в местах вызова.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Depends on: `W5-O`.
- AC: в admin usage отсутствуют пропсы `mt/mb`.
- AC: `layout.tsx` не содержит `mt/mb` в `Box/Group/Stack/Title` и `withSpacingStyle`.
- AC: `fields.tsx` не содержит `mt/mb` в `Select`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенные spacing-контракты в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Артефакт: migration `Group mb={...}` -> `style={{ marginBottom: ... }}` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-Q · Remove `Text` typography aliases (`c/fw/tt/size`) from admin layer (P1, status: done)
- Цель: убрать из admin bridge-примитива `Text` mantine-like алиасы (`c`, `fw`, `tt`, `size`) и перейти на явные `className/style` в местах использования.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-P`.
- AC: в admin usage отсутствуют `Text`-алиасы `c/fw/tt/size`.
- AC: `layout.tsx::Text` не содержит контракт `c/fw/tt/size`.
- AC: визуально эквивалентные стили заданы через `style`/`className` на уровне страниц.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенный `Text` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration `Text` usage в перечисленных `Admin*.tsx` и admin-drinks карточках.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-R · Prune unused admin spacing aliases and harden space/radius types (P1, status: done)
- Цель: убрать неиспользуемые compat-алиасы spacing в admin layout-слое (`px`, `pt`) и сузить типы `spacing/radius` до явных токенов вместо `unknown`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Depends on: `W5-Q`.
- AC: `withSpacingStyle` больше не поддерживает `px/pt`; контракты `Box/Container/Paper` синхронизированы с этим.
- AC: `resolveSpace` и `resolveRadius` используют строгие типы (`SpaceValue`, `RadiusValue`) вместо `unknown`.
- AC: admin usage не требует миграции и продолжает собираться без регрессий.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенный spacing/radius контракт в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-S · Remove `Select.w` compat prop from admin fields layer (P1, status: done)
- Цель: убрать mantine-like width alias `w` из admin `Select` и использовать явный `style/className` в usage-слоях.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-R`.
- AC: `SelectProps` не содержит `w`; layout ширина задается только через `style/className`.
- AC: в admin usage отсутствует `w={...}` на `Select`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенный `Select` контракт в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Артефакт: migration `w={180|320}` -> `style={{ width: ... }}` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-T · Remove `ActionIcon` variant aliases (`transparent/light/filled`) from admin layout layer (P1, status: done)
- Цель: убрать mantine-like alias-варианты `ActionIcon` и оставить только нативные `Button` variants (`default|secondary|ghost|outline|destructive`).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Depends on: `W5-S`.
- AC: `ActionIconProps.variant` не содержит `transparent/light/filled`.
- AC: `layout.tsx` не содержит маппинг alias-вариантов `mappedVariant`.
- AC: в admin usage отсутствует `ActionIcon variant="transparent"`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенный `ActionIcon` контракт в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration back-button `ActionIcon` usage в перечисленных `Admin*.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-U · Remove remaining layout aliases (`p/py/pb/gap/radius`) from admin layer and usage (P1, status: done)
- Цель: убрать последние mantine-like layout-алиасы из admin primitives (`Box/Container/Group/Stack/Paper/Badge`) и перевести usage на явные `style/className`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksFiltersCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-T`.
- AC: `layout.tsx` не содержит контрактов/утилит `p/py/pb/gap/radius`, `resolveSpace/resolveRadius/withSpacingStyle`, token-maps spacing/radius.
- AC: в admin usage отсутствуют пропсы `p/py/pb/gap/radius` на `Box/Container/Group/Stack/Paper/Badge`.
- AC: визуальный layout эквивалентен (spacing/radius сохранены через явные `style`).
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенные контракты `Box/Container/Group/Stack/Paper/Badge` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin pages/cards на explicit `style` для padding/gap/radius.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-V · Remove remaining container/border compat (`Container.size`, `Paper.withBorder`) from admin layer (P1, status: done)
- Цель: убрать финальные compat-пропсы `Container.size` и `Paper.withBorder` из admin layout-слоя и перевести usage на explicit `style` (`maxWidth`, `border`).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksFiltersCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-U`.
- AC: `layout.tsx::Container` не содержит контракт `size`.
- AC: `layout.tsx::Paper` не содержит контракт `withBorder`.
- AC: в admin usage отсутствуют `Container size=...` и `Paper withBorder`.
- AC: ширина/рамки сохранены через explicit `style` (`maxWidth`/`border`).
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: упрощенные `Container/Paper` контракты в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin pages/cards на explicit `maxWidth`/`border`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-W · Remove admin `Title` wrapper and migrate to native headings (P1, status: done)
- Цель: убрать последний typographic compat-компонент `Title` из admin layout-слоя и перейти на нативные `h3/h4` с явными классами.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-V`.
- AC: `layout.tsx` не содержит `Title` (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Title`; заголовки рендерятся как нативные `h3/h4`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: de-bridge typographic слой `Title` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin headings на `h3/h4` с explicit classes в перечисленных файлах.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-X · Remove admin `Text` wrapper and migrate to native text elements (P1, status: done)
- Цель: убрать `Text` из admin layout-слоя и перейти на нативные `p`/`span` с explicit style/className.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-W`.
- AC: `layout.tsx` не содержит `Text` (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Text`.
- AC: сценарий `lineClamp` сохранен через explicit CSS (`-webkit-line-clamp`) в модерации.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Text` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin text nodes на `p` с explicit style/className.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-Y · Remove admin `Group/Stack` wrappers and migrate to native layout containers (P1, status: done)
- Цель: убрать `Group/Stack` из admin layout-слоя и перейти на нативные `div` (`flex/grid`) с explicit styles.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksFiltersCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-X`.
- AC: `layout.tsx` не содержит `Group/Stack` (контракты + реализация).
- AC: в admin usage отсутствует импорт/usage `Group/Stack`.
- AC: layout-поведение сохранено через explicit `display:flex/grid`, `gap`, `justifyContent`, `alignItems`, `flexWrap`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: de-bridge layout wrappers в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin pages/cards на нативные layout контейнеры.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-Z · Remove admin `Box` wrapper and migrate to native `div` containers (P1, status: done)
- Цель: убрать `Box` из admin layout-слоя и перевести usage на нативные `div` с explicit `style/className`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Depends on: `W5-Y`.
- AC: `layout.tsx` не содержит `Box` (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Box`.
- AC: все layout-контейнеры `Box` заменены на нативные `div` без функциональных регрессий.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Box` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin pages на нативные `div` контейнеры.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AA · Remove admin `Container` wrapper and migrate to native wrappers (P1, status: done)
- Цель: убрать `Container` из admin layout-слоя и перевести usage на нативные `div` с explicit `maxWidth/margin/padding`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Depends on: `W5-Z`.
- AC: `layout.tsx` не содержит `Container` (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Container`.
- AC: контейнерный layout сохранен через явные `style` (`maxWidth`, `marginInline`, `paddingTop`, `paddingBottom`).
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Container` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin pages на нативные wrapper `div`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AB · Remove admin `Paper` wrapper and migrate to native card containers (P1, status: done)
- Цель: убрать `Paper` из admin layout-слоя и перевести usage на нативные `div` карточки с explicit border/radius/background styles.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksFiltersCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-AA`.
- AC: `layout.tsx` не содержит `Paper` (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Paper`.
- AC: визуальная структура карточек сохранена через explicit `style` на нативных контейнерах.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Paper` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration admin cards на нативные `div` контейнеры.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AC · Remove admin `Alert` wrapper and migrate to explicit inline alert blocks (P1, status: done)
- Цель: убрать `Alert` из admin layout-слоя и перевести usage на явные inline alert-блоки с explicit tone/title/icon styles.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Depends on: `W5-AB`.
- AC: `layout.tsx` не содержит `Alert` (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Alert`.
- AC: info/error alert-паттерны (с иконкой/заголовком) сохранены через explicit `div`-разметку и tone styles.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Alert` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration alert-blocks в admin pages на явную разметку.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AD · Remove admin `SegmentedControl` wrapper and migrate to explicit segmented buttons (P1, status: done)
- Цель: убрать `SegmentedControl` из admin layout-слоя и перевести usage на явные сегмент-кнопки в экранах.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Depends on: `W5-AC`.
- AC: `layout.tsx` не содержит `SegmentedControl` (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `SegmentedControl`.
- AC: visual behavior сегментов сохранен через explicit button-group markup/styles (включая styling активного сегмента и scrollable tabs в moderation).
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `SegmentedControl` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration segmented controls в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AE · Remove admin `Select` wrapper and migrate to direct `AppSelect` usage (P1, status: done)
- Цель: убрать admin wrapper `Select` из `fields`-слоя и перейти на прямой `AppSelect` с явной label-разметкой на страницах.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-AD`.
- AC: `fields.tsx` не содержит `Select` wrapper (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Select` из `features/admin/ui`.
- AC: сценарии `searchable/clearable/nothingFound/rightSection` сохранены через прямой `AppSelect`.
- AC: label/description layout сохранен через явные `label` контейнеры в местах usage.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Select` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Артефакт: migration admin select controls на `AppSelect` в перечисленных страницах/карточках.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AF · Remove admin `Switch` wrapper and migrate to explicit inline switch controls (P1, status: done)
- Цель: убрать admin wrapper `Switch` из `fields`-слоя и перевести usage на явные inline `button[role="switch"]` контролы.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksFiltersCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Depends on: `W5-AE`.
- AC: `fields.tsx` не содержит `Switch` wrapper (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Switch` из `features/admin/ui`.
- AC: UX toggle-состояний (`checked`, aria, visual active/inactive) сохранен через явную inline-разметку.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Switch` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Артефакт: migration switch controls на explicit inline `button[role="switch"]` в перечисленных страницах/карточках.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AG · Remove admin `TextInput` wrapper and migrate to direct `Input` usage (P1, status: done)
- Цель: убрать admin wrapper `TextInput` из `fields`-слоя и перевести usage на прямой `Input` с явной label/description-разметкой.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksFiltersCard.tsx`.
- Depends on: `W5-AF`.
- AC: `fields.tsx` не содержит `TextInput` wrapper (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `TextInput` из `features/admin/ui`.
- AC: label/required/description поведение сохранено через явную разметку в местах usage.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `TextInput` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Артефакт: migration input controls на `Input` в перечисленных страницах/карточках.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AH · Remove admin `Textarea` wrapper and migrate to explicit native textarea usage (P1, status: done)
- Цель: убрать admin wrapper `Textarea` из `fields`-слоя и перевести usage на явный нативный `textarea` с explicit label-разметкой.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Depends on: `W5-AG`.
- AC: `fields.tsx` не содержит `Textarea` wrapper (контракт + реализация).
- AC: в admin usage отсутствует импорт/usage `Textarea` из `features/admin/ui`.
- AC: styling и поведение `minRows/autosize` сохранены через explicit `rows/minHeight` + системные классы `textarea`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Textarea` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Артефакт: migration textarea controls на explicit native markup в перечисленных страницах/карточках.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AI · Remove empty admin `fields` layer and clean admin UI barrel (P1, status: done)
- Цель: удалить пустой `fields`-слой после завершения de-compat миграции полей и оставить `admin/ui` только с `layout` экспортами.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/index.ts`.
- Depends on: `W5-AH`.
- AC: файл `features/admin/ui/fields.tsx` удален.
- AC: barrel `features/admin/ui/index.ts` не реэкспортирует `./fields`.
- AC: в `frontend/src` отсутствуют прямые импорты `features/admin/ui/fields`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/fields.tsx`.
- Артефакт: очищенный barrel `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/index.ts`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AJ · Remove exported admin `Loader` wrapper and migrate external usage (P1, status: done)
- Цель: убрать публичный wrapper `Loader` из admin layout-слоя и перевести внешний usage на explicit inline spinner.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Depends on: `W5-AI`.
- AC: `layout.tsx` не экспортирует `Loader`; для внутренних `Button/ActionIcon loading` используется private spinner.
- AC: во `frontend/src` отсутствует импорт/usage `Loader` из `features/admin/ui`.
- AC: поведение loader в `AppSelect.rightSection` на странице управления кофейнями сохранено через explicit inline spinner.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: `Loader` de-export + private `Spinner` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration `rightSection` spinner в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AK · Remove admin `Badge` wrapper and migrate usage to new-ui/explicit markup (P1, status: done)
- Цель: убрать `Badge` wrapper из admin layout-слоя и перевести admin usage на `components/ui/Badge` или explicit inline markup там, где нужен `dot`-вариант.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Depends on: `W5-AJ`.
- AC: `layout.tsx` не содержит `Badge` wrapper (контракт + реализация).
- AC: во `frontend/src` отсутствует импорт/usage `Badge` из `features/admin/ui`.
- AC: бейджи в admin-drinks используют `components/ui/Badge`.
- AC: для moderation сохранен `dot`-паттерн через explicit inline badge-разметку.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Badge` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration badge usage в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AL · Remove admin `Table` wrapper and migrate usage to new-ui table component (P1, status: done)
- Цель: убрать `Table` wrapper из admin layout-слоя и перевести admin usage на reusable `components/ui/table.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/table.tsx` (new).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/index.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Depends on: `W5-AK`.
- AC: `layout.tsx` не содержит `Table` wrapper (контракт + реализация).
- AC: во `frontend/src` отсутствует импорт `Table` из `features/admin/ui`.
- AC: таблицы admin-страниц импортируют `Table` из `components/ui`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `Table` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: new-ui table primitive в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/table.tsx` + export в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/index.ts`.
- Артефакт: migration admin tables в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AM · Remove admin `ActionIcon` wrapper and migrate usage to icon buttons (P1, status: done)
- Цель: убрать `ActionIcon` wrapper из admin layout-слоя и перевести usage на `Button size="icon"` с explicit размером/стилем.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Depends on: `W5-AL`.
- AC: `layout.tsx` не содержит `ActionIcon` wrapper (контракт + реализация).
- AC: во `frontend/src` отсутствует импорт/usage `ActionIcon` из `features/admin/ui`.
- AC: back/action icon-buttons на admin-экранах работают через `Button variant="ghost" size="icon"` без UX-регрессий.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `ActionIcon` bridge в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`.
- Артефакт: migration icon-actions в перечисленных admin-экранах.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AN · Remove admin `Button` wrapper and migrate usage to base `components/ui/Button` (P1, status: done)
- Цель: убрать `Button` wrapper из admin layout-слоя и перевести admin usage на базовый `components/ui/Button` с явным inline spinner в loading-сценариях.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/index.ts` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminDrinksPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCatalogCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-AM`.
- AC: в проекте отсутствует `Button` wrapper в `features/admin/ui`.
- AC: во `frontend/src` отсутствуют импорты `features/admin/ui` (слой удален полностью).
- AC: loading-поведение admin-кнопок сохранено через `disabled + inline spinner`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удален admin UI-layer (`/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/layout.tsx`, `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin/ui/index.ts`).
- Артефакт: migration admin buttons на `components/ui/Button` в перечисленных страницах/карточках.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AO · Extract shared `Spinner` primitive and remove duplicated inline loader markup (P1, status: done)
- Цель: вынести повторяющийся inline loader-markup в единый `components/ui/Spinner` и убрать дубли в admin-экранах/карточках.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/spinner.tsx` (new).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/index.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksCreateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksEditCard.tsx`.
- Depends on: `W5-AN`.
- AC: в admin-зонах отсутствует дублированная inline spinner-разметка (`animate-spin ... border-t-transparent`) — вместо нее используется `Spinner`.
- AC: loading-поведение в кнопках/селектах сохранено.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: общий spinner primitive в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/spinner.tsx`.
- Артефакт: migration admin loading markers на `Spinner` в перечисленных файлах.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AP · De-bridge admin selects to `components/ui/Select` (P1, status: done)
- Цель: убрать зависимость admin-страниц/карточек от `AppSelect` (`ui/bridge`) и перевести их на новый `components/ui/Select`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/select.tsx` (new).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/index.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminFeedbackPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminNorthStarPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminModerationPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesImportPage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/AdminCafesManagePage.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/admin-drinks/ui/AdminDrinksUnknownCard.tsx`.
- Depends on: `W5-AO`.
- AC: перечисленные admin-файлы не импортируют `AppSelect` из `ui/bridge`.
- AC: добавлен reusable `Select` primitive в `components/ui`.
- AC: поведение searchable/clearable/rightSection для admin select-сценариев сохранено.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: новый `Select` primitive в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/select.tsx`.
- Артефакт: migration admin select usage в перечисленных страницах/карточках.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AQ · De-bridge discovery selects to `components/ui/Select` and zero-out `AppSelect` usage (P1, status: done)
- Цель: перевести discovery select-сценарии на общий `components/ui/Select` и убрать runtime-usage `AppSelect` вне bridge-слоя.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/sheet/DiscoveryLocationChoiceHeader.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/EmptyStateCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewFeed.tsx`.
- Depends on: `W5-AP`.
- AC: перечисленные discovery-файлы импортируют `Select` из `components/ui`, а не `AppSelect`.
- AC: глобальный поиск по `frontend/src` не показывает usage `AppSelect` вне `/ui/bridge/select.tsx`.
- AC: UX-поведение discovery select-сценариев (searchable/clearable/styles/rightSection) сохранено.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: migration discovery select usage в перечисленных feature-файлах.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AR · Remove obsolete `ui/bridge/select` after full Select migration (P1, status: done)
- Цель: удалить устаревший bridge `AppSelect` после полного перехода на `components/ui/Select`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/select.tsx` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts`.
- Depends on: `W5-AQ`.
- AC: файл `ui/bridge/select.tsx` удален.
- AC: `ui/bridge/index.ts` не реэкспортирует `./select`.
- AC: поиск по `frontend/src` не находит `AppSelect`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: удаленный `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/select.tsx`.
- Артефакт: очищенный bridge barrel `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AS · Remove obsolete `ui/bridge/form` by migrating discovery settings form wrappers (P1, status: done)
- Цель: убрать bridge-обертки `FormField/FormActions` и оставить в settings-дроуере нативную new-ui разметку.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/form.tsx` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts`.
- Depends on: `W5-AR`.
- AC: `SettingsDrawer` не импортирует `FormField/FormActions` из bridge.
- AC: `ui/bridge/form.tsx` удален, bridge barrel очищен от `./form`.
- AC: поиск по `frontend/src` не показывает usage `FormField/FormActions` из bridge.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: migration form wrappers в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`.
- Артефакт: удаленный `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/form.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AT · Remove obsolete `ui/bridge/tags-input` via `components/ui/TagsInput` migration (P1, status: done)
- Цель: убрать bridge `AppTagsInput` и перевести composer отзывов на reusable `components/ui/TagsInput`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/tags-input.tsx` (new).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/index.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewComposerCard.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/tags-input.tsx` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts`.
- Depends on: `W5-AS`.
- AC: `ReviewComposerCard` не импортирует `AppTagsInput` из bridge.
- AC: bridge-файл `ui/bridge/tags-input.tsx` удален, bridge barrel очищен от `./tags-input`.
- AC: поиск по `frontend/src` не показывает usage `AppTagsInput`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: новый `TagsInput` в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/tags-input.tsx`.
- Артефакт: migration review composer в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewComposerCard.tsx`.
- Артефакт: удаленный `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/tags-input.tsx`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AU · Remove obsolete `ui/bridge/overlay` by migrating `AppModal/AppSheet` to `components/ui` (P1, status: done)
- Цель: убрать overlay-bridge слой и использовать `AppModal/AppSheet` напрямую из `components/ui`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/overlay.tsx` (new).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/index.ts`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/PhotoLightboxModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/AuthGate.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoSubmissionModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoAdminModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/CafeDetailsScreen.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewFeed.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/modals/CafeProposalModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx` (delete).
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts` (delete).
- Depends on: `W5-AT`.
- AC: перечисленные файлы импортируют `AppModal/AppSheet` из `components/ui`, а не из bridge.
- AC: `ui/bridge/overlay.tsx` и `ui/bridge/index.ts` удалены.
- AC: поиск по `frontend/src` не показывает импортов `ui/bridge`.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: новый overlay primitive в `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/overlay.tsx`.
- Артефакт: migration modal/sheet usage в перечисленных product-компонентах.
- Артефакт: удаленные `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/overlay.tsx` и `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/ui/bridge/index.ts`.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.

### [x] W5-AV · Drop `implementation/comboboxProps` compatibility props from new UI contracts and call sites (P1, status: done)
- Цель: зачистить legacy-совместимость в new-ui API и убрать неиспользуемые compat-пропсы из интерфейсов/usage.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/overlay.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/select.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/ui/tags-input.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/AuthGate.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/components/PhotoLightboxModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoSubmissionModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafePhotoAdminModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/modals/CafeProposalModal.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/CafeDetailsScreen.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/details/reviews/ReviewFeed.tsx`.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`.
- Depends on: `W5-AU`.
- AC: в коде отсутствуют `implementation=` и `comboboxProps=` в JSX usage.
- AC: new-ui контракты `AppModal/AppSheet`, `Select`, `TagsInput` не содержат compat-пропсов `implementation`/`comboboxProps`.
- AC: поведение modal/sheet/select/tags-input сохранено без UX-регрессий.
- AC: `typecheck/build/tests` проходят без регрессий.
- Артефакт: очищенные new-ui контракты в `components/ui`.
- Артефакт: очищенные call sites в перечисленных product-компонентах.
- Проверка: `npm run typecheck`, `npm run build`, `npm test -- --watch=false` — pass.
