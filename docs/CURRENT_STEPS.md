# Development Log - BM Smart Parcel Tracker

## Session Info
* **Role:** BM_DEV (Senior Architect)
* **Date:** 2023-10-27 (Simulated)
* **Status:** Phase 2 - Backend Core

## Iteration Log

### Iteration 1.1: Infrastructure Hardening
* **Goal:** Secure Docker setup and fix dependency gaps.
* **Changes:**
    * [UPDATE] `backend/requirements.txt`: Added `python-multipart`, `ruff`, `google-generativeai`, `email-validator`. Moved `httpx` to main deps.
    * [UPDATE] `backend/Dockerfile`: Implemented non-root user `appuser` / `appgroup` for security; ENV for pip; added `curl`.
    * [UPDATE] `backend/app/core/config.py`: Pydantic v2 `SettingsConfigDict`; added `PROJECT_NAME`, `API_V1_STR`, `BACKEND_CORS_ORIGINS` with validator; `OPENAI_API_KEY`, `GEMINI_API_KEY`; kept `database_url`, `redis_url`, `debug`, `cbr_api_url` (and compat aliases).
    * [UPDATE] `backend/app/main.py`: CORS origins from `settings.BACKEND_CORS_ORIGINS` (fallback to localhost); title from `settings.PROJECT_NAME`.
    * [UPDATE] `backend/app/models/base.py`: Added `AsyncAttrs` to Base for async lazy loading. No new `app/db/base.py`; existing models and table names unchanged.

## Pending Tasks
- [ ] Implement Pydantic Schemas (`app/schemas/`) for API request/response.
- [ ] Initial Alembic migration and run against PostgreSQL.
- [ ] LLM Vision import pipeline (screenshot → orders).
- [ ] Currency module (CBR API or fixed rate).
