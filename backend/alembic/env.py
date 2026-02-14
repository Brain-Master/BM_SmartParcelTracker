"""Alembic env. Uses sync engine for migrations."""
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy import pool

from app.models.base import Base
from app.models import *  # noqa: F401, F403 — so all models are registered

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url():
    # Read from environment variable DATABASE_URL
    url = os.getenv("DATABASE_URL")
    
    if not url:
        # Fallback to alembic.ini if set
        url = config.get_main_option("sqlalchemy.url")
    
    if url is None or not url.strip():
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Set DATABASE_URL before running alembic commands."
        )
    
    url = url.strip()
    
    # Convert async URL to sync for alembic
    if url.startswith("postgresql+asyncpg"):
        return url.replace("postgresql+asyncpg", "postgresql", 1)
    return url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        get_url(),
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
