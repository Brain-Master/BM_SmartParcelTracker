# 📦 Smart Parcel Tracker

> Corporate PWA for tracking procurement, logistics chains, and inventory with AI-powered import.

**Status:** Active Development (MVP) — scaffold ready for dev  
**Stack:** Python 3.11+ (FastAPI, SQLAlchemy, Pydantic), React 18+ (Vite, Tailwind, TanStack Table), PostgreSQL 16, Redis, Docker Compose

## Key Features
- 📸 **AI Import:** Parse orders from screenshots using LLM Vision.
- 💱 **Multi-Currency:** Automatic conversion to base currency (RUB) with rate freezing.
- 📦 **Split Shipments:** Support for partial deliveries and consolidation (OrderItems ↔ Parcels).
- 📱 **Mobile First:** PWA with barcode scanner and offline-ready mode.

## Repo layout
- `backend/` — FastAPI app, SQLAlchemy models (User, Order, Parcel, OrderItem), Alembic
- `frontend/` — Vite + React, Master Table (TanStack Table), PWA manifest
- `docs/` — System Design audit and recommendations
- `docker-compose.yml` — PostgreSQL 16 + Redis + Backend

## Quick start
1. **DB + Redis + Backend:** `docker compose up -d` then open http://localhost:8000/docs  
2. **Apply DB migrations (required after clone or pull):**  
   - With Docker: `docker compose run --rm backend alembic upgrade head`  
   - Local: `cd backend && set DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/smart_parcel && alembic upgrade head` (or use your `.env`)  
3. **Backend only (local venv):** `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload` (set `DATABASE_URL` to local Postgres)  
4. **Frontend:** `cd frontend && npm install && npm run dev` → http://localhost:5173  

## Design doc
See `docs/SYSTEM_DESIGN_AUDIT.md` for architect & QA notes aligned with the internal System Design Document.
