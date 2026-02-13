from dataclasses import dataclass
import os


@dataclass(slots=True)
class TestSettings:
    database_url: str = os.getenv("SPT_DATABASE_URL", "file:test_db?mode=memory&cache=shared")
    testing: bool = os.getenv("SPT_TESTING", "1") == "1"
