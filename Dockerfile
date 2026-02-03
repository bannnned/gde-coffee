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

COPY --from=backend-build /app/server /app/server
COPY --from=frontend-build /app/frontend/dist /app/public
COPY --from=backend-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# нужно для healthcheck (обычно платформа использует wget/curl внутри контейнера)
RUN apk add --no-cache ca-certificates wget

CMD ["/app/server"]


