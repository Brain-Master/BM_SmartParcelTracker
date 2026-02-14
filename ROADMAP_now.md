# ROADMAP: Спринт 2.1 — Data Entry & Business Logic

**Проект:** BM Smart Parcel Tracker  
**Длительность:** 3–4 недели (15–20 рабочих дней)  
**Фокус:** CRUD-формы на фронтенде, модуль валют (CBR API), LLM Vision Import  
**Статус:** Готов к выполнению  
**Дата:** 14 февраля 2026  
**Предыдущий спринт:** Sprint 2.0 — ✅ COMPLETED (Auth UI, Filters, CSV, OrderItem API)

---

## Контекст и предпосылки

### Что уже готово (Sprint 2.0)

**Backend:**
- FastAPI + SQLAlchemy 2.0 (async), PostgreSQL
- JWT аутентификация (bcrypt), protected endpoints
- CRUD сервисы: User, Order, Parcel, OrderItem (с authorization checks)
- Pydantic schemas для всех entity (Create/Read/Update/WithItems)
- Alembic миграции (2 миграции выполнены)
- 27+ pytest тестов проходят (100%): auth(7), orders(6), parcels(6), order_items(5), users(3)
- Ruff linting: 0 ошибок
- Config: `cbr_api_url`, `GEMINI_API_KEY`, `redis_url` уже в `Settings`

**Frontend:**
- React 19 + Vite 7 + Tailwind 4
- TanStack Table с expandable rows (Parcel → OrderItems)
- ProtectedRoute, Login, Register, Profile страницы
- API client с token management
- Hooks: useAuth, useOrders, useParcels, useCurrentUser
- DesktopDashboard: фильтры (Потеряшки, Ожидают действий, Теги), CSV export
- MasterTable: expand/collapse, protection deadline colors, tag pills

**Infrastructure:**
- Docker Compose (dev + prod), GitHub Actions CI/CD
- Nginx config, Logging (structured)

**Что НЕ готово (gaps):**
1. **Нет UI для создания/редактирования данных** — нет OrderForm, ParcelForm, OrderItemForm
2. **Нет навигации** — только кнопка "Выйти", нет меню/header nav
3. **Currency Module** — поля `exchange_rate_frozen`, `price_final_base` есть в модели, но заполняются вручную клиентом
4. **LLM Vision** — endpoint и сервис не реализованы (только конфиг `GEMINI_API_KEY` в Settings)
5. **Нет Dashboard метрик** — нет summary cards (всего заказов, потеряшек, сумма)

---

## Цели спринта 2.1

**Primary Goal:**  
Дать пользователю полноценный UI для ввода данных + автоматизировать валютную конвертацию + опциональный LLM импорт.

**Success Criteria:**
- Пользователь может создавать заказы, посылки и товары через UI-формы
- При создании заказа в иностранной валюте курс автоматически загружается с ЦБ РФ
- Пользователь может переопределить курс вручную (manual override)
- Навигация между страницами интуитивна (header nav)
- Dashboard показывает summary карточки (статистика)
- [Опционально] Импорт заказов из скриншота через Gemini Vision

---

## Архитектурные решения

### Новые маршруты фронтенда

```
/                    → DesktopDashboard (existing, protected)
/login               → Login (existing)
/register            → Register (existing)
/profile             → Profile (existing, protected)
/orders/new          → OrderForm (NEW, protected)
/orders/:id/edit     → OrderForm (NEW, protected)
/parcels/new         → ParcelForm (NEW, protected)
/parcels/:id/edit    → ParcelForm (NEW, protected)
/import              → ImportOrder (NEW, protected, optional)
```

### Currency Module: Data Flow

```
User заполняет OrderForm
  → price_original: 25.99
  → currency_original: USD
  → user.main_currency: RUB
  ↓
Frontend POST /api/orders/ (без exchange_rate_frozen)
  ↓
Backend order_service.create_order()
  → currency_service.get_exchange_rate("USD", "RUB")
  → CBR API: https://www.cbr-xml-daily.ru/daily_json.js
  → exchange_rate_frozen = 92.45
  → price_final_base = 25.99 * 92.45 = 2402.77
  → is_price_estimated = true
  ↓
Response → frontend показывает "≈ 2 402.77 ₽ (курс ЦБ)"
```

### Service Layer Update

```
order_service.create_order(db, user_id, order_data)
  ├── NEW: вызывает currency_service если нужна конвертация
  ├── Вычисляет price_final_base
  └── Сохраняет order
```

---

## Задачи спринта

### Неделя 1: CRUD Forms + Navigation

#### Task 1.1: App Navigation / Layout (1 день)

**Цель:** Добавить header с навигацией на все страницы.

**Файлы:**
- `frontend/src/components/AppLayout.tsx` (новый)
- `frontend/src/App.tsx` (обновить)

**Требования:**
- Компонент `AppLayout` оборачивает все protected routes
- Header: логотип "📦 Smart Parcel Tracker", nav links, user email, кнопка Logout
- Nav links: "Главная" (/), "Новый заказ" (/orders/new), "Новая посылка" (/parcels/new), "Профиль" (/profile)
- Responsive: на mobile — hamburger menu
- Active link подсвечивается

**Interface:**
```tsx
// frontend/src/components/AppLayout.tsx
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header> {/* nav links, user info, logout */} </header>
      <main className="p-4 md:p-6">{children}</main>
    </div>
  )
}
```

**Изменения в App.tsx:**
```tsx
<Route path="/" element={
  <ProtectedRoute>
    <AppLayout>
      <Outlet />
    </AppLayout>
  </ProtectedRoute>
}>
  <Route index element={<DesktopDashboard />} />
  <Route path="orders/new" element={<OrderForm />} />
  <Route path="orders/:id/edit" element={<OrderForm />} />
  <Route path="parcels/new" element={<ParcelForm />} />
  <Route path="parcels/:id/edit" element={<ParcelForm />} />
  <Route path="profile" element={<Profile />} />
  <Route path="import" element={<ImportOrder />} />
</Route>
```

**При этом:**
- Убрать header/logout из `DesktopDashboard.tsx` (перенести в AppLayout)
- `DesktopDashboard` становится чисто контентной страницей

**Test Strategy:**
- Manual: проверить навигацию между страницами, active state, mobile hamburger

---

#### Task 1.2: OrderForm Page (2 дня)

**Цель:** Форма создания/редактирования заказа.

**Файлы:**
- `frontend/src/pages/OrderForm.tsx` (новый)
- `frontend/src/hooks/useOrders.ts` (обновить — добавить `createOrder`, `updateOrder`)

**Режимы:**
- **Create:** URL `/orders/new`, пустая форма
- **Edit:** URL `/orders/:id/edit`, предзаполненная форма

**Поля формы:**
| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|----------|
| platform | select | Да | AliExpress, Ozon, Wildberries, Amazon, Other |
| order_number_external | text | Да | Номер заказа на площадке |
| order_date | date | Да | Дата заказа |
| protection_end_date | date | Нет | Дата окончания защиты покупателя |
| price_original | number | Да | Стоимость в оригинальной валюте |
| currency_original | select | Да | RUB, USD, EUR, CNY |
| comment | textarea | Нет | Комментарий |

**Поля НЕ в форме (вычисляются backend-ом):**
- `exchange_rate_frozen` — заполняется currency_service (или вручную)
- `price_final_base` — вычисляется как `price_original * exchange_rate_frozen`
- `is_price_estimated` — true если курс автоматический

**UI:**
- Tailwind card layout (max-w-lg mx-auto)
- Validation: required fields, number > 0, date format
- Кнопка "Сохранить" → POST/PUT → redirect на `/`
- Кнопка "Отмена" → redirect на `/`
- Loading state при submit
- Error state при ошибке

**Hook update (`useOrders.ts`):**
```typescript
// Добавить в useOrders:
const createOrder = async (data: OrderCreateInput) => { ... }
const updateOrder = async (id: string, data: OrderUpdateInput) => { ... }
```

**Schema update (backend — опционально для этой задачи):**
- `OrderCreate` schema: сделать `exchange_rate_frozen`, `price_final_base`, `is_price_estimated` опциональными (backend заполнит если не переданы)
- Это подготовка для Task 2.1 (Currency Module)

**Test Strategy:**
- Manual: создать заказ, проверить что появился в таблице
- Manual: открыть существующий заказ, изменить, сохранить

---

#### Task 1.3: ParcelForm Page (1–2 дня)

**Цель:** Форма создания/редактирования посылки.

**Файлы:**
- `frontend/src/pages/ParcelForm.tsx` (новый)
- `frontend/src/hooks/useParcels.ts` (обновить — добавить `createParcel`, `updateParcel`)

**Режимы:**
- **Create:** URL `/parcels/new`
- **Edit:** URL `/parcels/:id/edit`

**Поля формы:**
| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|----------|
| tracking_number | text | Да | Трек-номер |
| carrier_slug | select/text | Да | Перевозчик (cdek, russian-post, usps, dhl, other) |
| status | select | Да | Created, In_Transit, PickUp_Ready, Delivered, Lost, Archived |
| weight_kg | number | Нет | Вес (кг) |

**UI:**
- Аналогично OrderForm (Tailwind card)
- Validation: tracking_number обязателен
- При создании посылки `status` по умолчанию = `Created`

**Hook update (`useParcels.ts`):**
```typescript
const createParcel = async (data: ParcelCreateInput) => { ... }
const updateParcel = async (id: string, data: ParcelUpdateInput) => { ... }
```

**Test Strategy:**
- Manual: создать посылку, проверить в таблице
- Manual: изменить статус посылки

---

#### Task 1.4: OrderItem Inline Add/Edit (2 дня)

**Цель:** Возможность добавлять товары к заказу и привязывать их к посылкам.

**Подход:** Модальное окно или inline-форма в MasterTable / OrderForm.

**Вариант A: Inline в OrderForm (рекомендуемый)**
- В OrderForm (при edit) показывать список order items
- Кнопка "+ Добавить товар" → inline form:
  - item_name (text, обязательное)
  - tags (text input с chips, через запятую)
  - quantity_ordered (number, default 1)
  - item_status (select)
  - parcel_id (select dropdown из списка пользовательских посылок)
- Кнопка "✕" для удаления товара

**Вариант B: Modal из MasterTable**
- В expanded row (item level) добавить кнопку "✏️ Редактировать"
- Открывает modal с полями item
- Кнопка "Привязать к посылке" → dropdown из посылок пользователя

**Файлы:**
- `frontend/src/components/OrderItemForm.tsx` (новый — переиспользуемый компонент)
- `frontend/src/hooks/useOrderItems.ts` (новый)
- `frontend/src/pages/OrderForm.tsx` (обновить — добавить секцию items)

**Hook `useOrderItems`:**
```typescript
export function useOrderItems(orderId?: string) {
  const createItem = async (data: OrderItemCreateInput) => { ... }
  const updateItem = async (id: string, data: OrderItemUpdateInput) => { ... }
  const deleteItem = async (id: string) => { ... }
  return { createItem, updateItem, deleteItem }
}
```

**Test Strategy:**
- Manual: в редактировании заказа добавить товар, привязать к посылке
- Manual: проверить что товар отображается в MasterTable

---

#### Task 1.5: Dashboard Summary Cards (1 день)

**Цель:** Показать ключевые метрики вверху DesktopDashboard.

**Файлы:**
- `frontend/src/components/SummaryCards.tsx` (новый)
- `frontend/src/pages/DesktopDashboard.tsx` (обновить)

**Карточки:**
| Карточка | Значение | Иконка |
|----------|---------|--------|
| Всего посылок | `parcels.length` | 📦 |
| В пути | `parcels.filter(p => p.status === 'In_Transit').length` | 🚚 |
| Потеряшки | Посылки `In_Transit` > 30 дней | 🚨 |
| Сумма заказов | `Σ price_final_base` | 💰 |

**UI:**
- Grid 2x2 (mobile) или 4x1 (desktop)
- Каждая карточка: иконка, число (крупный шрифт), подпись (мелкий шрифт)
- Кликабельные: "Потеряшки" активирует фильтр

**Test Strategy:**
- Manual: проверить что числа соответствуют данным в таблице

---

### Неделя 2: Currency Module (CBR API)

#### Task 2.1: Currency Service (1 день)

**Цель:** Сервис для получения курсов валют с ЦБ РФ.

**Файлы:**
- `backend/app/services/currency_service.py` (новый)

**Interface:**
```python
async def get_exchange_rate(
    from_currency: str,   # "USD", "EUR", "CNY"
    to_currency: str,     # "RUB", "USD", "EUR"
    date: str | None = None
) -> float:
    """
    Get exchange rate from CBR API.
    Returns rate: amount_to = amount_from * rate
    
    Raises:
        httpx.HTTPError — API недоступен
        ValueError — валюта не найдена
    """
```

**Особенности CBR API:**
- URL: `https://www.cbr-xml-daily.ru/daily_json.js`
- Формат: `{Valute: {USD: {Value: 92.45, Nominal: 1}, CNY: {Value: 12.8, Nominal: 1}}}`
- Base currency = RUB
- Nominal: для некоторых валют Nominal != 1 (напр. KZT Nominal=100 → Value = X за 100 KZT)

**Формулы:**
- `from_foreign_to_RUB = Value / Nominal`
- `from_RUB_to_foreign = Nominal / Value`
- `cross_rate(A → B) = (A_Value / A_Nominal) / (B_Value / B_Nominal)`

**Caching (in-memory):**
- Кешировать результат API на 1 час (простой dict + timestamp)
- При ошибке API использовать последний кеш (stale cache)

**Test Strategy:**
- Mock httpx response (фикстура с реальным JSON от CBR)
- Тесты:
  - `test_usd_to_rub` (прямая конвертация)
  - `test_rub_to_usd` (обратная)
  - `test_cross_rate_usd_to_eur`
  - `test_nominal_handling` (CNY, KZT)
  - `test_unknown_currency` → ValueError
  - `test_api_failure_uses_cache`

---

#### Task 2.2: Order Service — Auto-Conversion (1 день)

**Цель:** Интегрировать Currency Service в создание заказа.

**Файлы:**
- `backend/app/services/order_service.py` (обновить `create_order`)
- `backend/app/schemas/order.py` (обновить `OrderCreate`)

**Изменения в `OrderCreate`:**
```python
class OrderCreate(BaseModel):
    platform: str
    order_number_external: str
    order_date: datetime
    protection_end_date: datetime | None = None
    price_original: Decimal
    currency_original: str
    # NEW: Сделать опциональными — backend заполнит если не переданы
    exchange_rate_frozen: Decimal | None = None
    price_final_base: Decimal | None = None
    is_price_estimated: bool | None = None
    comment: str | None = None
```

**Изменения в `create_order`:**
```python
async def create_order(db, user_id, order_data, user_main_currency="RUB"):
    # Если exchange_rate не передан — получить автоматически
    if order_data.exchange_rate_frozen is None:
        if order_data.currency_original != user_main_currency:
            rate = await currency_service.get_exchange_rate(
                order_data.currency_original, user_main_currency
            )
            exchange_rate_frozen = rate
            is_price_estimated = True
        else:
            exchange_rate_frozen = 1.0
            is_price_estimated = False
    else:
        exchange_rate_frozen = order_data.exchange_rate_frozen
        is_price_estimated = order_data.is_price_estimated or False
    
    price_final_base = order_data.price_original * exchange_rate_frozen
    ...
```

**API endpoint update:**
- `POST /api/orders/` теперь принимает user's `main_currency` через `current_user` dependency
- Передавать `current_user.main_currency` в `create_order`

**Test Strategy:**
- Mock CBR API
- Тесты:
  - `test_create_order_auto_conversion` (USD order → RUB rate frozen)
  - `test_create_order_same_currency` (RUB → RUB, rate=1.0, is_price_estimated=False)
  - `test_create_order_manual_rate` (передан exchange_rate_frozen → используется как есть)
  - `test_create_order_cbr_failure` (API fail → fallback rate=1.0, is_price_estimated=True)

---

#### Task 2.3: Currency API Endpoint (1 день)

**Цель:** Отдельный endpoint для получения курса (для frontend preview).

**Файлы:**
- `backend/app/api/currency.py` (новый)
- `backend/app/main.py` (зарегистрировать router)

**Endpoint:**
```python
@router.get("/api/currency/rate")
async def get_rate(
    from_currency: str,    # query param
    to_currency: str,      # query param
    current_user = Depends(get_current_active_user)
):
    """Get exchange rate for preview (before creating order)."""
    rate = await currency_service.get_exchange_rate(from_currency, to_currency)
    return {
        "from_currency": from_currency,
        "to_currency": to_currency,
        "rate": rate,
        "source": "CBR",
        "date": datetime.now(UTC).isoformat()
    }
```

**Frontend Integration (в OrderForm):**
- При выборе `currency_original` != user.main_currency:
  - Fetch GET `/api/currency/rate?from_currency=USD&to_currency=RUB`
  - Показать preview: "≈ 2 402.77 ₽ (курс ЦБ: 92.45)"
  - Опция "Указать курс вручную" → показать input для `exchange_rate_frozen`

**Файлы (frontend):**
- `frontend/src/hooks/useCurrency.ts` (новый)
- `frontend/src/pages/OrderForm.tsx` (обновить — добавить currency preview)

**Hook `useCurrency`:**
```typescript
export function useCurrency() {
  const getRate = async (from: string, to: string) => {
    const response = await apiClient.get(`/api/currency/rate?from_currency=${from}&to_currency=${to}`)
    return response as { rate: number; source: string; date: string }
  }
  return { getRate }
}
```

**Test Strategy:**
- Backend: `test_get_rate_endpoint`
- Frontend: manual — выбрать USD, проверить что preview показывает курс

---

### Неделя 3: LLM Vision Import (Опционально) + Polish

#### Task 3.1: Vision Service (2 дня) — OPTIONAL

**Зависимость:** Требуется `GEMINI_API_KEY` в `.env`

**Цель:** Парсинг скриншотов заказов через Gemini Vision API.

**Файлы:**
- `backend/app/services/vision_service.py` (новый)
- `backend/app/api/vision.py` (новый)
- `backend/app/main.py` (зарегистрировать router)

**Endpoints:**
- `POST /api/vision/parse-order` — загрузить скриншот → получить preview
- `POST /api/vision/confirm-orders` — подтвердить и создать заказы

**Graceful Degradation:**
- Если `GEMINI_API_KEY` не задан → endpoint возвращает 503 "Vision service not configured"
- Если API недоступен → 502 "Vision service temporarily unavailable"

**Дедупликация:**
- Перед созданием заказа: проверить `order_number_external` у данного пользователя
- Если дубль → пометить `_duplicate: true` в preview

**Test Strategy:**
- Mock Gemini API response (фикстура с реальным JSON)
- Тесты:
  - `test_parse_screenshot_success`
  - `test_parse_screenshot_no_api_key`
  - `test_confirm_orders_skip_duplicates`

---

#### Task 3.2: ImportOrder Page (1 день) — OPTIONAL

**Файлы:**
- `frontend/src/pages/ImportOrder.tsx` (новый)

**UI Flow:**
1. Drag & drop зона или кнопка "Загрузить скриншот"
2. File → POST /api/vision/parse-order → loading spinner
3. Preview таблица: Order ID, Date, Platform, Items, Price
4. Строки с ⚠️ если duplicate
5. Checkboxes для выбора (deselect duplicates)
6. Кнопка "Создать выбранные заказы" → POST /api/vision/confirm-orders
7. Success → redirect на `/` с toast "Создано N заказов"

**Файлы (обновить):**
- `frontend/src/App.tsx` — добавить route `/import`
- `frontend/src/components/AppLayout.tsx` — добавить link "Импорт" в nav

---

#### Task 3.3: Vision Idempotency Cache (1 день) — OPTIONAL

**Цель:** Не вызывать LLM повторно для одного и того же изображения.

**Файлы:**
- `backend/app/models/vision_cache.py` (новый)
- `backend/alembic/versions/003_add_vision_cache.py` (новая миграция)
- `backend/app/services/vision_service.py` (обновить)

**Модель:**
```python
class VisionCache(Base, TimestampMixin):
    __tablename__ = "vision_cache"
    
    image_hash: Mapped[str] = mapped_column(String(64), primary_key=True)  # SHA256
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))
    result_json: Mapped[str] = mapped_column(Text)  # JSON string
```

**Логика:**
1. Вычислить SHA256 от image bytes
2. Поиск в `vision_cache` по `(image_hash, user_id)`
3. Если найден → вернуть cached result
4. Если нет → вызвать Gemini → сохранить в cache → вернуть

---

#### Task 3.4: Tests + CI Update (1 день)

**Цель:** Убедиться что все новые endpoints покрыты тестами.

**Новые тесты:**
- `backend/tests/test_currency.py`:
  - `test_get_rate_usd_to_rub`
  - `test_get_rate_same_currency`
  - `test_get_rate_endpoint`
  - `test_create_order_auto_conversion`
  - `test_create_order_manual_override`
  - `test_currency_api_failure`

- `backend/tests/test_vision.py` (если Task 3.1 реализован):
  - `test_parse_screenshot`
  - `test_confirm_orders`
  - `test_vision_cache`

**CI Update:**
- Обновить `.github/workflows/ci.yml` — добавить `httpx` mock dependency если нужно

**Целевое количество тестов:** ≥ 35 (было 27+)

---

## Definition of Done

### Week 1: CRUD Forms
- [ ] AppLayout с header nav работает на всех protected routes
- [ ] OrderForm: create/edit заказов через UI
- [ ] ParcelForm: create/edit посылок через UI
- [ ] OrderItemForm: добавление/редактирование товаров к заказам
- [ ] Dashboard summary cards показывают статистику
- [ ] Навигация: все страницы доступны из header

### Week 2: Currency Module
- [ ] `currency_service.py` получает курсы с CBR API
- [ ] `create_order` автоматически конвертирует валюту
- [ ] `GET /api/currency/rate` endpoint для frontend preview
- [ ] OrderForm показывает preview курса (≈ X ₽)
- [ ] Manual override работает (пользователь может задать свой курс)
- [ ] Backend тесты для currency (6+ тестов)

### Week 3: Vision + Polish (OPTIONAL)
- [ ] Vision service парсит скриншоты (если GEMINI_API_KEY задан)
- [ ] ImportOrder page позволяет загрузить скриншот
- [ ] Preview + confirm flow работает
- [ ] Дедупликация по order_number_external
- [ ] Vision cache предотвращает повторные вызовы LLM
- [ ] Все CI/CD checks проходят

---

## Риски и зависимости

### Риски

**1. CBR API нестабилен (downtime, формат изменится)**
- **Вероятность:** Низкая (API стабилен годами)
- **Митигация:** In-memory cache + stale cache при ошибках + fallback rate=1.0

**2. Gemini API требует API key и может быть платным**
- **Вероятность:** Высокая (ключ нужно получить)
- **Митигация:** Task 3.x помечены как OPTIONAL, graceful degradation (503 без ключа)

**3. OrderCreate schema изменение может сломать существующие тесты**
- **Вероятность:** Средняя
- **Митигация:** Сделать новые поля optional с дефолтами, обновить тесты

**4. Сложность UI форм (валидация, state management)**
- **Вероятность:** Средняя
- **Митигация:** Использовать react-hook-form или простой useState с validation

### Зависимости

```
Task 1.1 (AppLayout) ← все остальные задачи Week 1
Task 1.2 (OrderForm) ← Task 1.4 (OrderItemForm, добавляется в OrderForm)
Task 1.2 (OrderForm) ← Task 2.3 (Currency preview в OrderForm)
Task 2.1 (Currency Service) ← Task 2.2 (Auto-conversion)
Task 2.1 (Currency Service) ← Task 2.3 (Currency endpoint)
Task 3.1 (Vision Service) ← Task 3.2 (ImportOrder page)
Task 3.1 (Vision Service) ← Task 3.3 (Vision cache)
```

**Критический путь:**  
Task 1.1 → Task 1.2 → Task 2.2 → Task 2.3 (currency in OrderForm)

**Независимые задачи (можно параллелить):**
- Task 1.3 (ParcelForm) — независим от OrderForm
- Task 1.5 (Summary Cards) — независим
- Task 2.1 (Currency Service backend) — независим от frontend

---

## Метрики успеха

**Количественные:**
- Frontend bundle size: < 380 KB (gzipped), было ~287 KB
- Backend test count: ≥ 35 тестов (было 27+)
- Backend test pass rate: 100%
- All CI/CD checks pass (lint, type check, tests, build)
- Currency API response time: < 2s (включая CBR fetch, < 50ms с кешем)

**Качественные:**
- Пользователь может полностью работать с приложением через UI (CRUD всех entity)
- Валютная конвертация "just works" без ручного ввода курса
- Навигация интуитивна (не нужно знать URL-ы)
- Код следует Clean Architecture (service layer для бизнес-логики)

---

## После спринта 2.1

**Что будет готово:**
- ✅ Полный CRUD через UI (заказы, посылки, товары)
- ✅ Автоматическая конвертация валют (CBR API)
- ✅ Navigation + Dashboard metrics
- ✅ [Опционально] LLM Vision Import

**Что НЕ будет готово (следующие спринты):**
- Tracking queue (Redis + Celery) — Iteration 2.2
- Protection deadline alerts (email/push) — Iteration 2.2
- Rate limiting (slowapi) — Iteration 2.2
- PWA offline mode — Iteration 2.3
- Barcode scanner — Iteration 2.3
- Frontend тесты (Vitest) — Iteration 2.3
- Monitoring (Sentry, Prometheus) — Iteration 2.3

**Следующий фокус (Спринт 2.2):**  
Tracking Queue, Protection Alerts, Rate Limiting — см. `ROADMAP_next-planned.md`

---

## Приложение: Mermaid Диаграммы

### Currency Conversion Flow

```mermaid
sequenceDiagram
    participant User
    participant OrderForm
    participant Backend
    participant CBR API

    User->>OrderForm: Ввести price=25.99, currency=USD
    OrderForm->>Backend: GET /api/currency/rate?from=USD&to=RUB
    Backend->>CBR API: GET daily_json.js
    CBR API->>Backend: {Valute: {USD: {Value: 92.45}}}
    Backend->>OrderForm: {rate: 92.45}
    OrderForm->>User: Preview: "≈ 2 402.77 ₽"
    
    User->>OrderForm: Нажать "Сохранить"
    OrderForm->>Backend: POST /api/orders/ (без exchange_rate)
    Backend->>Backend: currency_service.get_exchange_rate()
    Backend->>Backend: price_final_base = 25.99 * 92.45
    Backend->>OrderForm: {order: {..., price_final_base: 2402.77}}
    OrderForm->>User: Redirect to Dashboard
```

### Vision Import Flow

```mermaid
sequenceDiagram
    participant User
    participant ImportPage
    participant Backend
    participant Gemini

    User->>ImportPage: Upload screenshot.jpg
    ImportPage->>Backend: POST /api/vision/parse-order (file)
    Backend->>Gemini: image + prompt
    Gemini->>Backend: JSON {orders: [...]}
    Backend->>Backend: Check duplicates
    Backend->>ImportPage: {preview: orders, duplicates marked}
    ImportPage->>User: Show preview table
    
    User->>ImportPage: Confirm selected orders
    ImportPage->>Backend: POST /api/vision/confirm-orders
    Backend->>Backend: Create orders + items
    Backend->>ImportPage: {created: 3}
    ImportPage->>User: Redirect to Dashboard
```

### Navigation Map

```mermaid
graph LR
    A[Login] -->|auth| B[Dashboard]
    C[Register] -->|auth| B
    B --> D[OrderForm /new]
    B --> E[ParcelForm /new]
    B --> F[Profile]
    B --> G[Import]
    D -->|save| B
    E -->|save| B
    G -->|confirm| B
    D -->|edit| H[OrderForm /:id/edit]
    H -->|save| B
```

---

**Документ подготовлен:** 14 февраля 2026  
**Автор:** AI Assistant  
**Версия:** 2.1  
**Статус:** Ready for Sprint Planning
