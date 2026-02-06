# Account Security Flows

## Email verification
- Request: creates token and sends email with link.
- Confirm: consumes token, marks `email_verified_at`, redirects to `/settings?verified=1`.

### Curl
```bash
# request (auth required)
curl -i -b cookies.txt -X POST http://localhost:8080/api/auth/email/verify/request

# confirm (token from email link)
curl -i "http://localhost:8080/api/auth/email/verify/confirm?token=RAW"
```

## Email change
- Request: requires current password, sends link to new email.
- Confirm: updates email, marks verified, revokes sessions, redirects `/settings?email_changed=1`.

### Curl
```bash
curl -i -b cookies.txt -X POST http://localhost:8080/api/account/email/change/request \
  -H "Content-Type: application/json" \
  -d '{"new_email":"new@example.com","current_password":"secret"}'

curl -i "http://localhost:8080/api/account/email/change/confirm?token=RAW"
```

## Password reset
- Request: always returns 200, sends email only if local credentials exist.
- Confirm: sets new password, revokes sessions.

### Curl
```bash
curl -i -X POST http://localhost:8080/api/auth/password/reset/request \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

curl -i -X POST http://localhost:8080/api/auth/password/reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"token":"RAW","new_password":"new-secret-123"}'
```