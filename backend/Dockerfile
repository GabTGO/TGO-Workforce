# Local development only (via ../docker-compose.yml). Railway builds this
# service with Railpack (confirmed via the live service config — the
# "NIXPACKS" builder named in railway.json is stale), not this Dockerfile —
# this exists purely so `docker compose up` gives a one-command local stack.
#
# No pg_dump here: this service only ever *queues* a backup request (see
# app/api/routes/backups.py) — the worker (Dockerfile.worker) is the only
# place that actually runs pg_dump, since only it can install a client new
# enough for this project's Postgres 18 server (see
# app/services/backup.py's module docstring).
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
