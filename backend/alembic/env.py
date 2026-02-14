"""Alembic env. Uses sync engine for migrations."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy import pool

from app.models.base import Base
from app.models import *  # noqa: F401 — so all models are registered

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url():
    # Prefer DATABASE_URL_SYNC for migrations (postgresql://), else derive from async
    url = config.get_main_option("sqlalchemy.url")
    if url is None:
        raise RuntimeError(
            "Alembic sqlalchemy.url is not set. "
            "Configure it in alembic.ini [alembic] section or set the ALEMBIC_DATABASE_URL environment variable."
        )
    url = url.strip()
    if not url:
        raise RuntimeError(
            "Alembic sqlalchemy.url is empty. Set sqlalchemy.url in alembic.ini [alembic] section."
        )
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
