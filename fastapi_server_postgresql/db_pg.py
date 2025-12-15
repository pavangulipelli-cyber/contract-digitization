# db_pg.py
# PostgreSQL database helpers using psycopg2

import os
import psycopg2
import psycopg2.extras
from typing import Optional, List, Dict, Any

# Database configuration from environment
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "contract_ai_postgres_db"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "password")
}

def get_conn():
    """Get PostgreSQL connection with RealDictCursor for dict-like row access."""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)

def db_get(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    """Execute query and return single row as dict."""
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def db_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Execute query and return all rows as list of dicts."""
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def db_run(sql: str, params: tuple = ()) -> Dict[str, int]:
    """Execute statement and return changes/lastrowid."""
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return {"changes": cursor.rowcount, "lastID": cursor.lastrowid if hasattr(cursor, 'lastrowid') else None}
    finally:
        conn.close()

def db_exec(sql: str):
    """Execute script (multiple statements)."""
    conn = get_conn()
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
    finally:
        conn.close()
