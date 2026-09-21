# Local development only (via ../docker-compose.yml). Railway builds this
# service with Railpack (confirmed via the live service config — the
# "NIXPACKS" builder named in railway.json is stale), not this Dockerfile —
# this exists purely so `docker compose up` gives a one-command local stack.
FROM python:3.12-slim

# pg_dump, for the manual "Backup Now" route (app/services/backup.py) —
# see backend/railpack.json's deploy.aptPackages for the equivalent on Railway.
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
