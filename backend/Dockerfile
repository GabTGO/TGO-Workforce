# Local development only (via ../docker-compose.yml). Railway builds this
# service with Nixpacks (see railway.json), not this Dockerfile — this exists
# purely so `docker compose up` gives a one-command local stack.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
