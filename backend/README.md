# BM Smart Parcel Tracker - Backend

FastAPI backend with PostgreSQL 16, SQLAlchemy 2.0, and async support.

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 16
- Redis 7 (optional, for future features)

### Installation

1. Create virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run migrations:
```bash
alembic upgrade head
```

### Running

Development server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or with Docker Compose (from project root):
```bash
docker-compose up -d
```

## Database Migrations

Create new migration:
```bash
alembic revision --autogenerate -m "Description"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback:
```bash
alembic downgrade -1
```

## Testing

Run all tests:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=app --cov-report=html
```

Run specific test file:
```bash
pytest tests/test_auth.py -v
```

## Code Quality

Lint code:
```bash
ruff check .
```

Format code:
```bash
ruff format .
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── api/           # API endpoints
│   ├── core/          # Core functionality (config, database, security)
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic layer
│   └── main.py        # FastAPI application
├── alembic/           # Database migrations
├── tests/             # Test suite
├── requirements.txt   # Dependencies
└── Dockerfile         # Docker configuration
```

## Key Features

- JWT authentication
- Async SQLAlchemy 2.0
- Pydantic v2 validation
- Database migrations with Alembic
- Service layer architecture
- Comprehensive error handling
- Logging configuration
- Test suite with pytest

## Environment Variables

See `.env.example` for all available configuration options.

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT secret key

Optional:
- `REDIS_URL` - Redis connection string
- `OPENAI_API_KEY` - OpenAI API key
- `GEMINI_API_KEY` - Google Gemini API key
- `BACKEND_CORS_ORIGINS` - Comma-separated list of allowed origins
