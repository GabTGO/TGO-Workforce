# TGO Workforce API (backend)

FastAPI + SQLAlchemy (async) + Alembic, talking to Postgres. Deploys to Railway as
its own service alongside the frontend (see [Deployment](#deployment) below).

## Status

Scaffold only — no domain tables yet. `app/models/` and `app/schemas/` are empty
apart from a placeholder comment; they get filled in once the Postgres table
definitions are provided, followed by an Alembic migration.

## Local setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

cp .env.example .env        # then point DATABASE_URL at your local Postgres
```

You need a local Postgres running (Docker is the quickest way):

```bash
docker run --name tgo-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tgo_workforce -p 5432:5432 -d postgres:16
```

Run the app:

```bash
uvicorn app.main:app --reload
```

- API root: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health
- DB connectivity check: http://localhost:8000/health/db

## Migrations (Alembic)

Once models exist in `app/models/`:

```bash
alembic revision --autogenerate -m "add employees table"
alembic upgrade head
```

`alembic/env.py` reads `DATABASE_URL` the same way the app does (via
`app.core.config.Settings`), so there's one source of truth for the connection
string — no separate URL to keep in sync.

## Tests & linting

```bash
pytest
ruff check .
```

`tests/test_health.py` also doubles as a smoke test for the async
SQLAlchemy + asyncpg wiring — CI runs it against a real Postgres service
container, not a mock.

## Project layout

```
backend/
  app/
    core/
      config.py   # env-driven Settings (pydantic-settings)
      db.py        # async engine/session, Base, get_db() dependency
      auth.py      # get_current_account() — stub until Zoho SSO lands
    api/routes/    # one module per resource: health, accounts, activity_logs, employees
    models/        # SQLAlchemy models: Account, ActivityLog, Employee
    schemas/       # Pydantic request/response schemas, mirroring models/
    services/      # record_activity(), next_employee_id() — shared logic routes call into
    main.py        # FastAPI app, CORS, router registration
  alembic/         # migration environment (async-aware env.py) + versions/
  tests/
  requirements.txt / requirements-dev.txt
  railway.json     # Railway build/start config for this service
```

## Deployment

This backend and the frontend deploy as **two separate Railway services from
the same GitHub repo** (a monorepo), plus a managed Postgres plugin:

1. In Railway, create one project.
2. Add a **Postgres** plugin to it.
3. Add a service for the **frontend**: connect this GitHub repo, root directory
   `/` (the default) — it picks up `/railway.json` at the repo root. The repo
   root also has an `.nvmrc` (and `package.json` has `engines.node`) pinning
   Node 22 — without one of these, Railway's Nixpacks builder can pick a
   stale/EOL Node version and fail the build.
4. Add a service for the **backend**: connect the same repo, but set its root
   directory to `backend/` — it picks up `backend/railway.json`.
5. On the backend service, set environment variables:
   - `DATABASE_URL` → reference the Postgres plugin: `${{Postgres.DATABASE_URL}}`
   - `CORS_ORIGINS` → the deployed frontend URL (plus `http://localhost:3000`
     for local dev against a deployed backend, if you ever do that)
   - `SECRET_KEY`, and the `ZOHO_*` vars once SSO is wired up
6. On **each** service's Settings → Source, leave "Auto deploys when pushed to
   GitHub" **on**, and turn **on "Wait for CI"**. That makes Railway hold off
   building/deploying a push until the GitHub Actions checks from
   `.github/workflows/ci-cd.yml` (lint/build for the frontend, lint/test for
   the backend) succeed on that commit — the actual CI gate, using Railway's
   own deploy rather than a separate CLI step. No Railway API token needed.

After that, every push to `main` runs CI for both frontend and backend, and
Railway only builds/deploys either service once its checks pass.
