# TGO Workforce API (backend)

FastAPI + SQLAlchemy (async) + Alembic, talking to Postgres. Deploys to Railway as
its own service alongside the frontend (see [Deployment](#deployment) below).

## Status

Accounts, employees, and activity logs are live, with Zoho OAuth wired up for
sign-in (see [Zoho SSO](#zoho-sso) below). Not yet done: locking the
employees/accounts/activity-log endpoints behind `require_account` (they're
still reachable without a session — only the identity of "who made this
change" changes once you're signed in), and reconnecting the frontend's
in-memory employee store to call this API instead of its local mock data.

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

```bash
alembic upgrade head                              # apply pending migrations
alembic revision --autogenerate -m "add x table"  # generate a new one from model changes
```

Always run `alembic upgrade head` before autogenerating a new revision — Alembic
refuses to diff against a database that isn't already at head.

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
      auth.py      # get_current_account() / require_account() — resolve the session cookie to an Account
    api/routes/    # one module per resource: health, auth, accounts, activity_logs, employees
    models/        # SQLAlchemy models: Account, ActivityLog, Employee
    schemas/       # Pydantic request/response schemas, mirroring models/
    services/      # record_activity(), next_employee_id(), zoho.py (OAuth HTTP calls) — shared logic routes call into
    main.py        # FastAPI app, CORS, session cookie middleware, router registration
  alembic/         # migration environment (async-aware env.py) + versions/
  tests/
  requirements.txt / requirements-dev.txt
  railway.json     # Railway build/start config for this service
```

## Zoho SSO

Sign-in is Zoho OAuth (`AaaServer.profile.READ` scope — just enough to read
email/name/ZUID, no access to Zoho Mail/CRM/etc.). The flow:

1. Frontend sends the browser to `GET /auth/zoho/login` (a full page
   navigation, not a fetch — Zoho's login page has to be top-level).
2. This backend redirects to Zoho with a random `state` value stashed in the
   session, for CSRF protection.
3. Person signs in on Zoho's own page and approves the app.
4. Zoho redirects back to `GET /auth/zoho/callback`. This backend exchanges
   the code for a token, fetches the profile, and upserts an `Account` row
   matched on Zoho's stable `ZUID` (brand new accounts default to the
   `viewer` role — an admin promotes them from there; there's no public
   "create account" endpoint on purpose).
5. On success, this backend sets a signed, httpOnly session cookie and
   redirects to `FRONTEND_URL`. `GET /auth/me` (called with
   `credentials: "include"`) is how the frontend asks "who is this cookie
   for, if anyone." `POST /auth/logout` clears it.

If `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REDIRECT_URI` aren't all
set, `/auth/zoho/login` returns `503` instead of trying to redirect anywhere.

The session cookie is `SameSite=None; Secure` in production (required since
the frontend and backend live on different Railway domains) and plain `Lax`,
non-secure locally. That means the frontend must call the backend with
`credentials: "include"` on every request that should carry it, and
`CORS_ORIGINS` must list the frontend's exact origin — `allow_credentials`
doesn't work with a wildcard `*` origin.

### Registering the app in Zoho's API Console (one-time)

1. Go to https://api-console.zoho.com and sign in with the Zoho account that
   should own this integration (usually an admin/IT account, not a personal
   one).
2. **Add Client** → **Server-based Applications**.
3. Client Name: `TGO Workforce`. Homepage URL: the frontend's deployed URL
   (e.g. `https://<frontend>.up.railway.app`).
4. Authorized Redirect URIs: this **backend's** URL plus `/auth/zoho/callback`
   — e.g. `https://<backend>.up.railway.app/auth/zoho/callback`. Must match
   `ZOHO_REDIRECT_URI` exactly, character for character, including the
   scheme.
5. Save. Zoho shows a **Client ID** and **Client Secret** — copy both.
6. Set on the backend Railway service: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`,
   `ZOHO_REDIRECT_URI` (the same URL from step 4).
7. For local dev, add `http://localhost:8000/auth/zoho/callback` as a second
   Authorized Redirect URI on the same client, and use that value for
   `ZOHO_REDIRECT_URI` in your local `.env`.

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
   - `FRONTEND_URL` → the deployed frontend URL — where `/auth/zoho/callback`
     sends the browser back to after sign-in
   - `SECRET_KEY` — signs the session cookie; any long random string
   - `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REDIRECT_URI` — see
     [Zoho SSO](#zoho-sso) above
   On the **frontend** service: `VITE_API_URL` → the deployed backend URL.
   Vite bakes this in at build time, so it has to be set before the frontend
   builds, not just at runtime.
6. On **each** service's Settings → Source, leave "Auto deploys when pushed to
   GitHub" **on**, and turn **on "Wait for CI"**. That makes Railway hold off
   building/deploying a push until the GitHub Actions checks from
   `.github/workflows/ci-cd.yml` (lint/build for the frontend, lint/test for
   the backend) succeed on that commit — the actual CI gate, using Railway's
   own deploy rather than a separate CLI step. No Railway API token needed.

After that, every push to `main` runs CI for both frontend and backend, and
Railway only builds/deploys either service once its checks pass.
