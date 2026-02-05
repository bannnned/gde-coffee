# Auth Identities (OAuth readiness)

## Что это
`identities` — таблица, которая связывает пользователя с внешними провайдерами (local, github, yandex, vk, telegram). Это позволяет добавить OAuth без рефакторинга моделей и сессий.

## Правила мерджа (mergeByEmail)
Сервис `ResolveUserForIdentity` работает так:
1. Ищет identity по `(provider, provider_user_id)`.
2. Если нет и `mergeByEmail=true` и `email_normalized` есть — пытается найти пользователя по `users.email_normalized`.
3. Если нашли — создает identity для этого пользователя.
4. Если не нашли — создает нового пользователя и identity.
5. Все внутри транзакции, с обработкой гонок уникальности.

## Local identity
При `POST /api/auth/register` создается identity с:
- provider = `local`
- provider_user_id = user_id
- email/email_normalized = email
- display_name = display_name

## Пример будущего OAuth callback (псевдокод)
```go
// после получения профиля от провайдера
identity := auth.Identity{
    Provider: auth.ProviderGitHub,
    ProviderUserID: profile.ID,
    Email: &profile.Email,
    DisplayName: &profile.Name,
    AvatarURL: &profile.AvatarURL,
}

userID, created, err := auth.ResolveUserForIdentity(ctx, pool, identity, true)
if err != nil { /* handle */ }

// создать session и set-cookie
```