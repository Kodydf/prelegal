# --- Stage 1: build the static frontend ---
FROM node:24-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: FastAPI backend serving the static frontend ---
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.13 /uv /usr/local/bin/uv
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/app ./app
# Document catalog and legal templates, read by the backend at startup.
COPY catalog.json ./content/catalog.json
COPY templates ./content/templates
COPY --from=frontend /frontend/out ./static
ENV PATH="/app/.venv/bin:$PATH" \
    PRELEGAL_DB_PATH=/tmp/prelegal.db \
    PRELEGAL_CONTENT_DIR=/app/content
EXPOSE 8000
# The SQLite DB lives in the container's /tmp and is recreated at every startup.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
