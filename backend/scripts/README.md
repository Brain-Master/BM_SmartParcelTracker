# Backend Scripts

Utility scripts for database management and testing.

## Available Scripts

### `seed_test_data.py`

Seeds the database with test data for development and testing.

**What it creates:**
- Test user account: `test@example.com` / `testpass123`
- 7 test orders from various platforms (AliExpress, Ozon, Wildberries, Amazon)
- 7 parcels with different statuses
- 11 order items with various tags

**Test scenarios included:**
1. Normal delivery in progress
2. Lost parcel (>30 days no tracking update) - triggers "Lost Parcels" filter
3. Action required (protection ending in 3 days) - triggers "Action Required" filter
4. Delivered but incomplete (quantity mismatch) - triggers "Action Required" filter
5. Pickup ready
6. USD order with currency conversion
7. Large order with multiple items and gift tags

**Usage:**

```bash
# From backend directory
cd backend

# Activate virtual environment (if not already active)
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Run the seeding script
python scripts/seed_test_data.py
```

**Requirements:**
- Database must be running (Docker Compose should be up)
- Alembic migrations must be applied: `alembic upgrade head`
- All dependencies installed: `pip install -r requirements.txt`

**Note:** The script is idempotent - it checks if the test user already exists and won't create duplicates. However, it will create new orders/parcels each time you run it.

### `clear_orders_parcels.py`

Removes all orders, parcels, order_items, and parcel_items from the database. **Users are preserved.**

**Usage:**
```bash
cd backend
python scripts/clear_orders_parcels.py
```

## Future Scripts

- `clear_test_data.py` - Remove all test data (including users)
- `create_admin.py` - Create admin user for production
- `backup_db.py` - Backup database to file
- `restore_db.py` - Restore database from backup
