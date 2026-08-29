# ---- Build stage ----
FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Runtime dependency stage ----
FROM oven/bun:1-alpine AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production --omit=optional --omit=peer

# ---- Runtime stage ----
# Needs at least 3.23 for ffmpeg but deliberately not pinning to receive
# regular updates to ffmpeg and ffprobe
FROM alpine:3

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ffmpeg ca-certificates libstdc++ libgcc

# Install Bun, using the musl build that matches Alpine.
# The baseline variant increases compatibility with negligible performance impact.
RUN apk add --no-cache --virtual .bun-build-deps unzip \
    && wget -qO /tmp/bun.zip "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64-musl-baseline.zip" \
    && unzip -qj /tmp/bun.zip '*/bun' -d /usr/local/bin \
    && chmod +x /usr/local/bin/bun \
    && rm /tmp/bun.zip \
    && apk del .bun-build-deps

# Install mkbrr
RUN MKBRR_VERSION=$(wget -qS -O /dev/null https://github.com/autobrr/mkbrr/releases/latest 2>&1 \
        | grep -i '^ *location:' | tail -1 | grep -o '[^/]*$' | tr -d '\r' | sed 's/^v//') \
    && wget -qO- "https://github.com/autobrr/mkbrr/releases/download/v${MKBRR_VERSION}/mkbrr_${MKBRR_VERSION}_linux_x86_64.tar.gz" \
        | tar -xz -C /usr/local/bin mkbrr

# Set locale
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Copy build output and production dependencies
COPY --from=builder /app/build ./build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create the only application-writable directory and a non-root runtime user.
# A bind mount replaces /config at runtime, so deployments must make that
# directory writable by the configured container UID.
RUN addgroup -S -g 1001 ak \
    && adduser -S -D -H -u 1001 -G ak ak \
    && mkdir -p /config/tmp \
    && chown -R 1001:1001 /config

# App configuration
ENV PORT=51901
ENV ORIGIN=http://localhost:51901
ENV TMPDIR=/config/tmp

EXPOSE 51901

USER 1001:1001
CMD ["bun", "run", "build/index.js"]
