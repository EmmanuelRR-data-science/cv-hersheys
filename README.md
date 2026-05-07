# Hershey's CV System

Full-stack image processing system for capturing product images on mobile (PWA), processing them via a FastAPI + Celery pipeline, and reviewing results in a web dashboard.

## Services (Docker Compose)

| Service | URL / Port | Purpose |
|---|---:|---|
| Backend API (`backend-api`) | http://localhost:8000 | FastAPI REST API |
| API Docs | http://localhost:8000/docs | Swagger UI |
| Dashboard (`dashboard`) | http://localhost:5173 | Analyst dashboard |
| Dashboard Health | http://localhost:5173/health | JSON health for load balancers |
| Mobile App (`mobile-app`) | http://localhost:5174 | Mobile PWA for capture/upload |
| PostgreSQL (`postgres`) | localhost:5432 | Metadata storage |
| Redis (`redis`) | localhost:6379 | Queue + cache |
| MinIO (`minio`) | http://localhost:9000 | Object storage for images |
| MinIO Console | http://localhost:9001 | MinIO admin console |

## Quickstart

```bash
docker compose up -d
```

Then open:

- API health: http://localhost:8000/health
- API docs: http://localhost:8000/docs
- Dashboard: http://localhost:5173
- Mobile app: http://localhost:5174
- MinIO console: http://localhost:9001

## Default credentials

### Application (API)

- Username: `hersheys`
- Password: `cv-hersheys`

### MinIO

- Access key: `minioadmin`
- Secret key: `minioadmin`

### PostgreSQL

- Database: `hersheys_cv`
- User: `hersheys`
- Password: `hersheys`
- Host/Port: `localhost:5432` (from your host), `postgres:5432` (from other containers)

## Usage

### 1) Get a JWT access token

```bash
curl -sS -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"hersheys","password":"cv-hersheys"}'
```

Response shape:

```json
{ "access_token": "<JWT>", "token_type": "bearer" }
```

Validate the token:

```bash
curl -sS http://localhost:8000/api/v1/me -H "Authorization: Bearer <JWT>"
```

### 2) Dashboard (token login)

1. Open http://localhost:5173
2. Paste the `access_token`
3. Browse results, use search and filters, open details

### 3) Mobile app (fixed credentials)

The compose configuration provides `VITE_API_USERNAME`/`VITE_API_PASSWORD` so the mobile app can fetch a token automatically.

1. Open http://localhost:5174
2. Capture an image
3. Upload (supports retry and offline queue)

## Tests

### Integration (containers)

Runs the end-to-end tests and smoke tests inside Docker:

```bash
docker compose run --rm backend-tests
```

### Frontend unit tests

```bash
cd dashboard && npm run test:run
cd mobile-app && npm run test:run
```

## Troubleshooting

- **Vite 403 “host not allowed” inside Docker**: the Vite servers are configured with `allowedHosts` for `dashboard` and `mobile-app`.
- **Database init scripts**: schema + seed scripts are mounted to Postgres `/docker-entrypoint-initdb.d/` and run automatically only on first DB initialization (fresh volume).
- **Running backend tests on host**: the backend runtime image installs `--no-dev` dependencies by default; integration tests are executed via `backend-tests` in Docker.

