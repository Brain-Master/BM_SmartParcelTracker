# BM Smart Parcel Tracker — Backend
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Use sync DB URL for local; override with env in compose
ENV DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/smart_parcel
ENV REDIS_URL=redis://redis:6379/0

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
