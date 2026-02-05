# Auth API (cookie sessions)

Base URL: `http://localhost:8080`

## Register

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret","display_name":"User"}'
```

## Login

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
```

## Me

```bash
curl -i -b cookies.txt http://localhost:8080/api/auth/me
```

## Logout

```bash
curl -i -b cookies.txt -X POST http://localhost:8080/api/auth/logout
```

## Health

```bash
curl -i http://localhost:8080/_health
curl -i http://localhost:8080/_health/deep
```