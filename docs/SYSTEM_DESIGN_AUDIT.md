# System Design Document — Senior Architect & QA Audit

**Document:** BM Smart Parcel Tracker (Internal Corp)  
**Status:** Final / Ready for Dev  
**Audit Role:** Senior Architect & QA

---

## 1. Architecture Assessment

### Strengths
- **Normalized schema** correctly models Order (financial) vs Parcel (logistic) vs OrderItems (SKU link). Supports split shipments and consolidation.
- **Frozen exchange rate** (`exchange_rate_frozen`, `is_price_estimated`) avoids recalculation drift and gives clear UX for manual correction.
- **Tracking priority tiers** (High/Normal/Low/Frozen) with Redis/Celery are appropriate to avoid API rate limits and bans.
- **LLM post-processing** (dedupe by `order_number_external`, currency from symbol) reduces duplicate orders and wrong currency.

### Gaps & Recommendations

| Area | Finding | Recommendation |
|------|--------|----------------|
| **Auth** | Users table only; no auth flow in doc. | Add: `password_hash`, `refresh_token` (or rely on corp IdP). Define JWT or session strategy. |
| **Parcel uniqueness** | `tracking_number` is Index, NOT Unique. | Intentional for same TN across carriers; document that uniqueness is `(user_id, tracking_number, carrier_slug)` if applicable. |
| **OrderItems.parcel_id** | Nullable FK. | Good. Enforce at app layer: when `item_status` = Shipped/Received, `parcel_id` must be set (DB trigger or CHECK optional). |
| **Protection alerts** | `protection_end_date` on Order; "10 / 5 / 2 days" in UI. | Add computed column or index on `protection_end_date` for "Ожидают действий" and cron-based alerts. |
| **Export >1000 rows** | Async generation mentioned. | Define: task queue (Celery), storage (S3/local), signed URL or in-app download; retention (e.g. 24h). |
| **Vision pipeline** | No idempotency key. | For same screenshot re-upload, use hash of image or (user_id, uploaded_at) to avoid duplicate runs. |

---

## 2. QA & Test Strategy Alignment

### Unit (Backend)
- **Currency:** Add tests for `main_currency = currency_original` (no conversion), and for rounding to 2 decimals (e.g. 1.115 → 1.12).
- **LLM parsing:** Test missing fields (`tracking_number`, `price_value`), malformed JSON, and empty list.

### Integration
- **Tracking mock:** Implement a **TrackingMockService** with configurable responses (In_Transit, Delivered, 404) and use in CI; never call real carrier API in tests.
- **DB:** Add FK constraint tests (e.g. insert OrderItem with invalid `parcel_id` → expect integrity error).
- **Export:** Assert CSV row count and sum of `price_final_base` (or equivalent) equals DB aggregate; test JSON structure (Orders → OrderItems → Parcels).

### UAT Checklist (from doc) — Coverage
- ✅ Multi-currency + manual rate edit and recalculation.
- ✅ Screenshot import → 5 items as OrderItems (and dedupe behavior).
- ✅ Split delivery: 2 items → Parcel A, 1 item → Parcel B; table grouping correct.
- ✅ Scan unknown tracking → offer "Create new parcel".
- ✅ Tag on item → present in CSV export.

**Additional UAT:**  
- Protection deadline colors (green / yellow / red) and "пульсирующий" at <2 days.  
- "Потеряшки" filter (no update >30 days).  
- "Принять выбранное" with partial selection → "Некомплект" alert.

---

## 3. Security & Compliance (Internal Use)

- **PII on screenshots:** Documented as user responsibility. Recommend: short in-app notice before first Vision upload and optional checkbox "I confirm no personal data on this image."
- **API keys:** LLM (OpenAI/Gemini) and ЦБ РФ (if used) must be env vars; never in repo.
- **Export:** "Export All" should be scoped to current user only; no admin export of other users without explicit role.

---

## 4. Stack Verification (Frozen)

| Layer | Spec | Notes |
|-------|------|--------|
| BE | Python 3.11+, FastAPI, SQLAlchemy, Pydantic | Align. Add `alembic` for migrations. |
| FE | React 18+, Vite, TailwindCSS, Shadcn/UI | Align. TanStack Table for Master Table. |
| DB | PostgreSQL 16 | Align. |
| Infra | Docker Compose (App + DB + Redis) | Align. Optional: Celery worker in same compose. |

---

## 5. Definition of Done (per module)

- **Currency:** API ЦБ РФ (or fallback) integrated; `is_price_estimated` and manual override in UI; tests for converter and rounding.
- **LLM Import:** Vision endpoint; dedupe by `order_number_external`; currency from symbol; tests with mock LLM response.
- **Tracking:** Queue (Redis + Celery/BullMQ); priority logic; mock in tests; no real carrier calls in CI.
- **Export:** CSV flat + JSON full; async for >1000; integrity test (sum, row count).
- **Desktop UI:** TanStack Table, grouping Parcel → OrderItems; tags as pills; filters (потеряшки, теги, ожидают действий); protection colors; CSV export button.
- **Mobile:** PWA manifest; FAB → scanner; barcode → "Содержимое посылки" + checkboxes; "Принять выбранное" and некомплект alert.

---

*Audit complete. Proceeding to implementation scaffold.*
