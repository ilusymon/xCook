FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/xcook-api ./cmd/api

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S xcook \
    && adduser -S -G xcook xcook

COPY --from=builder /out/xcook-api /usr/local/bin/xcook-api

USER xcook
EXPOSE 8081

ENTRYPOINT ["/usr/local/bin/xcook-api"]
