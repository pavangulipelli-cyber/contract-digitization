"""
db_pg.py (updated)

PostgreSQL helper utilities using psycopg2.

This is compatible with the FastAPI version you had (imports expected):
    from db_pg import get_conn, db_get, db_all, db_run, db_exec

Notes:
- Uses RealDictCursor so fetchone()/fetchall() return dict-like rows.
- Reads DB_* settings from environment (Azure Function App Settings or local .env).
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

import psycopg2
import psycopg2.extras


def get_conn():
    """Create a new PostgreSQL connection."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "contract_ai_postgres_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def db_get(sql: str, params: Optional[Sequence[Any]] = None) -> Optional[Dict[str, Any]]:
    """Fetch a single row (or None)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, tuple(params or ()))
        return cur.fetchone()
    finally:
        conn.close()


def db_all(sql: str, params: Optional[Sequence[Any]] = None) -> List[Dict[str, Any]]:
    """Fetch all rows."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, tuple(params or ()))
        return list(cur.fetchall())
    finally:
        conn.close()


def db_run(sql: str, params: Optional[Sequence[Any]] = None) -> Dict[str, Any]:
    """Run an INSERT/UPDATE/DELETE and return changes."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, tuple(params or ()))
        conn.commit()
        return {"changes": cur.rowcount}
    finally:
        conn.close()


def db_exec(sql: str) -> None:
    """Execute a SQL script (may include multiple statements)."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
    finally:
        conn.close()
