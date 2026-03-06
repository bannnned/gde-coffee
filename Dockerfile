# 1) build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
ARG VITE_TASTE_MAP_V1_ENABLED=0
ARG VITE_MAP_STYLE_URL=
ARG VITE_MAP_STYLE_URL_LIGHT=
ARG VITE_MAP_STYLE_URL_DARK=
ARG VITE_MAP_CITY_LABEL_FONT_STACK=
ENV VITE_TASTE_MAP_V1_ENABLED=$VITE_TASTE_MAP_V1_ENABLED
ENV VITE_MAP_STYLE_URL=$VITE_MAP_STYLE_URL
ENV VITE_MAP_STYLE_URL_LIGHT=$VITE_MAP_STYLE_URL_LIGHT
ENV VITE_MAP_STYLE_URL_DARK=$VITE_MAP_STYLE_URL_DARK
ENV VITE_MAP_CITY_LABEL_FONT_STACK=$VITE_MAP_CITY_LABEL_FONT_STACK
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN echo "[frontend-build] VITE_TASTE_MAP_V1_ENABLED=${VITE_TASTE_MAP_V1_ENABLED}"
RUN npm run build

# 2) build backend
FROM golang:1.24.1-alpine AS backend-build
WORKDIR /app
COPY backend/go.mod backend/go.sum ./backend/
WORKDIR /app/backend
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app/server .

# 3) runtime
FROM alpine:3.21
WORKDIR /app

ENV GIN_MODE=release

RUN apk add --no-cache ca-certificates curl wget && update-ca-certificates

RUN addgroup -g 1000 appgroup && adduser -D -u 1000 -G appgroup appuser

COPY backend/ca.crt /app/ca.crt
COPY --from=backend-build /app/server /app/server
COPY --from=frontend-build /app/frontend/dist /app/public

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=12 \
  CMD sh -ec 'curl -fsS --max-time 3 http://127.0.0.1:8080/_health >/dev/null || wget -qO /dev/null http://127.0.0.1:8080/_health'

CMD ["/app/server"]
