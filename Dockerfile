# ─── Estágio 1: build do frontend React (Vite) ─────────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@10.34.3 --activate \
    && pnpm install --frozen-lockfile
COPY frontend/ .
# Em produção o SPA é servido pelo Django sob /static/frontend/, então o base é relativo a isso.
ENV VITE_BASE=/static/frontend/
RUN pnpm build

# ─── Estágio 2: runtime Django + gunicorn + whitenoise ─────────────────────
FROM python:3.14-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv
COPY --chown=nobody:nogroup backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY --chown=nobody:nogroup backend/ /srv/backend/
# Cria STATIC_ROOT (whitenoise emite warning se o diretório não existir).
RUN mkdir -p /srv/backend/staticfiles
# Frontend compilado entra no caminho esperado por settings.FRONTEND_DIST.
COPY --chown=nobody:nogroup --from=frontend /src/frontend/dist /srv/frontend/dist

WORKDIR /srv/backend

# Migra, popula o catálogo e o admin (ambos idempotentes) e sobe o servidor WSGI.
CMD ["sh", "-c", "python manage.py migrate \
    && python manage.py seed_options \
    && python manage.py seed_admin \
    && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2"]

EXPOSE 8000