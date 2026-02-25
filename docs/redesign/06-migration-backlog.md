# Этап 0: Migration Backlog (Wave 1)

Документ переводит спецификации Wave 1 в рабочие задачи разработки.

Связанные документы:
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/00-goals.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/01-practical-ui-rules.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/01a-practical-ui-rubric.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/02-scope-wave1.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/03-definition-of-done.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/screens/discovery.md`
- `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/screens/discovery-settings.md`

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

### [ ] W1-BL-011 · Полировка верхних тегов и auth-гейтинга (P0, status: todo)
- Цель: сделать поведение тегов предсказуемым для гостя и авторизованного пользователя.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FiltersBar.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Depends on: `W1-BL-010`
- AC: неавторизованный пользователь видит понятное ограничение без “мертвых” действий.
- AC: выбранные пользователем теги не конфликтуют с популярными тегами.

### [ ] W1-BL-020 · BottomSheet shell и state-модель (P0, status: todo)
- Цель: стабилизировать и упростить поведение `peek/mid/expanded` без дергания UI.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.module.css`
- Depends on: `W1-BL-003`
- AC: переключение состояний листа предсказуемо на touch/mouse.
- AC: лист не скрывается “слишком рано” при drag вниз.
- AC: horizontal swipe в фото/контенте не ломает drag листа.

### [ ] W1-BL-021 · Header-контент листа и визуальная слоистость (P0, status: todo)
- Цель: убрать визуальные артефакты “обрезания” карточек за выбранной кофейней.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/BottomSheet.module.css`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeCard.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/cafe-card/CafeCardHero.tsx`
- Depends on: `W1-BL-020`
- AC: выбранная карточка читается как слой над списком.
- AC: элементы списка под карточкой исчезают плавно по заданной зоне fade.
- AC: нет заметного clipping по краям карточек при скролле.

### [ ] W1-BL-030 · Редизайн списка кофеен и состояний загрузки (P0, status: todo)
- Цель: унифицировать стиль списка, скелетонов и empty/error в рамках Wave 1.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/CafeList.module.css`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/EmptyStateCard.tsx`
- Depends on: `W1-BL-020`
- AC: loading-state визуально соответствует новому стилю и не дергает layout.
- AC: empty/error-state дает понятный следующий шаг (retry/гео/город).
- AC: отступы и ширина списка согласованы с выбранной карточкой.

### [ ] W1-BL-031 · Floating controls и map-overlays (P1, status: todo)
- Цель: согласовать кнопки карты с новым UI и устранить шум map-контролов.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/components/FloatingControls.module.css`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/index.css`
- Depends on: `W1-BL-030`
- AC: floating-кнопки визуально и размерно согласованы с шапкой/листом.
- AC: служебные map-контролы не засоряют интерфейс и не перекрывают действия.

### [ ] W1-BL-040 · Redesign Settings Drawer IA (P0, status: todo)
- Цель: перестроить настройки в последовательный flow “место -> фильтрация -> контент”.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Depends on: `W1-BL-011`
- AC: пользователь за <=2 шага находит место, радиус, теги.
- AC: группировка блоков соответствует спецификации `discovery-settings.md`.
- AC: отсутствуют прозрачные/некликабельные контролы.

### [ ] W1-BL-041 · Redesign Settings Drawer controls (P0, status: todo)
- Цель: единый современный стиль `Select/Chip/Button/Radius presets` внутри Drawer.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/styles/glass.ts`
- Depends on: `W1-BL-040`
- AC: радиус по умолчанию `5 км` и управление радиусом работает на мобильных.
- AC: select/чипы читаемы, контрастны, без визуальных сбоев в светлой/темной теме.
- AC: сценарий “гео недоступно -> выбрать город” работает без тупиков.

### [ ] W1-BL-042 · Tag picker и top-tags UX (P0, status: todo)
- Цель: сделать flow выбора тегов простым и устойчивым.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/ui/settings/SettingsDrawer.tsx`
- Depends on: `W1-BL-041`
- AC: исключены дубликаты тегов в UI и отправке.
- AC: поиск существующего тега работает, несуществующий тег не добавляется.
- AC: сохранение дает понятное состояние `saving/success/error`.

### [ ] W1-BL-050 · Интеграция сценариев и ручной smoke-pack (P0, status: todo)
- Цель: подтвердить целостность Wave 1 end-to-end.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/03-definition-of-done.md`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/01a-practical-ui-rubric.md`
- Depends on: `W1-BL-030`, `W1-BL-042`
- AC: пройдены ключевые сценарии Discovery из `screens/discovery.md`.
- AC: каждый измененный экран имеет rubric score >= 17/20.
- AC: критичных ошибок в консоли и падений UI нет.

### [ ] W1-BL-051 · Метрики и событиевая консистентность (P1, status: todo)
- Цель: убедиться, что UX-редизайн не ломает продуктовые события.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/features/discovery/hooks/useDiscoveryPageController.ts`
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/frontend/src/pages/DiscoveryScreen.tsx`
- Depends on: `W1-BL-050`
- AC: события `cafe_card_open`, `route_click`, `review_read`, `checkin_start`, `review_submit` не потеряны.
- AC: нет дублей событий из-за нового UI-потока.

### [ ] W1-BL-052 · Typecheck, build, release notes Wave 1 (P0, status: todo)
- Цель: закрыть инженерный контур и зафиксировать результат.
- Scope: `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/`
- Depends on: `W1-BL-050`
- AC: `typecheck` и production build проходят.
- AC: документация Wave 1 обновлена после фактических изменений.
- AC: зафиксирован список открытых рисков перед стартом Wave 2.

## 5. Exit criteria для перехода к Wave 2

1. Все задачи `P0` в состоянии `done`.
2. Стабильны ключевые сценарии:
- `гео -> выбор кофейни -> деталка -> назад`,
- `настройки -> радиус/теги -> обновление выдачи`.
3. iOS Safari/PWA не имеет критичных визуальных багов по safe-area и drag.
4. Wave 1 проходит общий DoD из `/Users/a1/Desktop/Prog/gde-coffee/docs/redesign/03-definition-of-done.md`.
