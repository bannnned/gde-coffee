# 1) build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) build backend
FROM golang:1.24.1-alpine AS backend-build
WORKDIR /app
COPY backend/go.mod backend/go.sum ./backend/
WORKDIR /app/backend
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server .

# 3) runtime
FROM alpine:3.19
WORKDIR /app

ENV GIN_MODE=release

# важно: curl для healthcheck + certs
RUN apk add --no-cache ca-certificates curl && update-ca-certificates

COPY --from=backend-build /app/server /app/server
COPY --from=frontend-build /app/frontend/dist /app/public

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=2s --start-period=10s --retries=12 \
  CMD curl -fsS http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["/app/server"]




