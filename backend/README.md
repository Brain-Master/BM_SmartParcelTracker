# Backend — BM Smart Parcel Tracker

Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic, PostgreSQL 16.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Set `.env` (optional):

- `DATABASE_URL` or use default `postgresql+asyncpg://postgres:postgres@localhost:5432/smart_parcel`
- `REDIS_URL` for Celery (later)

## Database

Create DB and run migrations:

```bash
# Sync URL for Alembic (in alembic.ini or env)
alembic upgrade head
```

Or create tables on startup (dev): `uvicorn app.main:app --reload` runs `init_db()`.

## Run

```bash
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs

## Structure

- `app/core` — config, database
- `app/models` — User, Order, Parcel, OrderItem (System Design §2.1)
- `app/schemas` — Pydantic (to expand)
- `app/api` — routers (orders, parcels, users)
