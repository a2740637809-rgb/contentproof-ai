from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


def check_database() -> str:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return "ok"


def ensure_prototype_columns() -> None:
    if engine.dialect.name != "sqlite":
        return
    additions = {
        "source_records": {
            "status": "VARCHAR NOT NULL DEFAULT 'pending'",
        },
        "workflow_runs": {
            "started_at": "DATETIME",
            "completed_at": "DATETIME",
            "elapsed_ms": "INTEGER",
        },
        "workflow_steps": {
            "started_at": "DATETIME",
            "completed_at": "DATETIME",
            "elapsed_ms": "INTEGER",
        },
    }
    with engine.begin() as connection:
        for table, columns in additions.items():
            existing = {
                row[1]
                for row in connection.execute(
                    text(f"PRAGMA table_info({table})")
                ).fetchall()
            }
            for column, definition in columns.items():
                if column not in existing:
                    connection.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                    )

