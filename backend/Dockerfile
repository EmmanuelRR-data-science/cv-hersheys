FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app

WORKDIR /app

FROM ghcr.io/astral-sh/uv:0.11.6 AS uv

FROM base AS runtime

COPY --from=uv /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock /app/

RUN uv sync --frozen --no-dev

COPY app /app/app

EXPOSE 8000

CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
