# syntax=docker/dockerfile:1
# Multi-stage production build for JalDrishti (Frontend + Flask Backend)

# ---------------------------------------------------------------------------
# Stage 1: Build React Frontend
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Production Python Runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runner

# System security updates and curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (Gunicorn included on Linux)
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/
COPY assets/ ./assets/

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Persistent data directory for SQLite database, backups, and lock file
RUN mkdir -p /data && chmod 777 /data
VOLUME ["/data"]

ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    ENVIRONMENT=production \
    DEBUG=false \
    DATABASE_URL=sqlite:////data/jaldrishti.db \
    COLLECTOR_LOCK_FILE=/data/collector.lock

EXPOSE 8000

# Default entrypoint: Production Gunicorn WSGI server
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60", "backend.app:app"]
