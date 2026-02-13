import sqlite3

import pytest

from app.models import init_db
from app.settings import TestSettings


@pytest.fixture(scope="session")
def test_settings() -> TestSettings:
    return TestSettings()


@pytest.fixture()
def db_conn(test_settings: TestSettings) -> sqlite3.Connection:
    conn = sqlite3.connect(test_settings.database_url, uri=True)
    init_db(conn)
    yield conn
    conn.close()
