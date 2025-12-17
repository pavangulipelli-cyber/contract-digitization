"""
orchestrator_azure_func.py

Azure Functions HTTP "orchestrator API" that replaces the FastAPI server.

What this does:
- Exposes the same REST endpoints your React Review UI expects:
  - GET  /health
  - GET  /api/documents
  - GET  /api/documents/{document_id}
  - GET  /api/documents/{document_id}/versions
  - GET  /api/documents/{document_id}/attributes?version=latest|<n>&includeVersion=1|0
  - GET  /api/documents/{document_id}/attributes/export?format=csv|json&version=latest|<n>
  - POST /api/documents/{document_id}/review

- Talks to PostgreSQL server-side (no DB credentials in the browser).
- Optionally posts review payloads to Conga (sync or "fire-and-forget").

How to wire this in Azure Functions (classic model):
- Create an HTTP-triggered Function.
- In function.json set a wildcard route, e.g.:
  "route": "{*path}"
  and allow methods: GET, POST, OPTIONS
- Point the Function entryPoint to: "orchestrator_azure_func.main"

If you're using the newer Python programming model (FunctionApp decorators),
you can port these handlers into @app.route functions, but the logic remains the same.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import azure.functions as func
import psycopg2
import psycopg2.extras

from conga_client import get_conga_client

# ---------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "contract_ai_postgres_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")

PG_SCHEMA_FILE = os.getenv("PG_SCHEMA_FILE", "./data/contract_ai_schema_postgres.sql")
PG_SEED_FILE = os.getenv("PG_SEED_FILE", "./data/contract_ai_seed_postgres.sql")

AUTO_INIT_DB = os.getenv("AUTO_INIT_DB", "false").lower() in ("1", "true", "yes")
CONGA_CALL_MODE = os.getenv("CONGA_CALL_MODE", "async").lower()  # "async" or "sync"
CORS_ALLOW_ORIGIN = os.getenv("CORS_ALLOW_ORIGIN", "*")

_SCHEMA_READY = False
_SCHEMA_LOCK = asyncio.Lock()


# ---------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------

def _json_serializer(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    if isinstance(value, timedelta):
        return value.total_seconds()
    return value


def _with_cors_headers(headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    base = {
        "Access-Control-Allow-Origin": CORS_ALLOW_ORIGIN,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
    }
    if headers:
        base.update(headers)
    return base


def _json_response(payload: Any, status: int = 200, headers: Optional[Dict[str, str]] = None) -> func.HttpResponse:
    return func.HttpResponse(
        body=json.dumps(payload, default=_json_serializer),
        status_code=status,
        mimetype="application/json",
        headers=_with_cors_headers(headers),
    )


def _text_response(body: str, status: int = 200, mimetype: str = "text/plain", headers: Optional[Dict[str, str]] = None) -> func.HttpResponse:
    return func.HttpResponse(
        body=body,
        status_code=status,
        mimetype=mimetype,
        headers=_with_cors_headers(headers),
    )


def _error(status: int, message: str, code: str = "error") -> func.HttpResponse:
    return _json_response({"ok": False, "code": code, "message": message}, status=status)


def _get_path(req: func.HttpRequest) -> str:
    # Works both for wildcard routes and normal routes.
    try:
        return urlparse(req.url).path or "/"
    except Exception:
        return "/"


def _to_storage_url(req: func.HttpRequest, storage_ref: Optional[str]) -> Optional[str]:
    """Convert storageRef to full URL.

    - If storage_ref is already an absolute URL, return as-is.
    - Otherwise, treat it as a relative path served by the same host.
    """
    if not storage_ref:
        return None
    if storage_ref.startswith("http://") or storage_ref.startswith("https://"):
        return storage_ref
    ref = storage_ref.lstrip("/")

    parsed = urlparse(req.url)
    scheme = req.headers.get("x-forwarded-proto") or parsed.scheme or "https"
    host = req.headers.get("x-forwarded-host") or req.headers.get("host") or parsed.netloc
    return f"{scheme}://{host}/{ref}"


# ---------------------------------------------------------------------
# PostgreSQL helpers (self-contained; avoids relying on truncated uploads)
# ---------------------------------------------------------------------

def _get_conn():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def _db_get(sql: str, params: Optional[Tuple[Any, ...]] = None) -> Optional[Dict[str, Any]]:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return cur.fetchone()
    finally:
        conn.close()


def _db_all(sql: str, params: Optional[Tuple[Any, ...]] = None) -> List[Dict[str, Any]]:
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return list(cur.fetchall())
    finally:
        conn.close()


# ---------------------------------------------------------------------
# Optional schema init (dev only)
# ---------------------------------------------------------------------

async def _ensure_schema_if_enabled() -> None:
    global _SCHEMA_READY
    if not AUTO_INIT_DB:
        return
    if _SCHEMA_READY:
        return

    async with _SCHEMA_LOCK:
        if _SCHEMA_READY:
            return

        conn = None
        try:
            conn = _get_conn()
            cur = conn.cursor()

            # Check if expected table exists
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema='public' AND table_name='documents'
                ) AS ok
                """
            )
            exists = cur.fetchone()["ok"]
            schema_applied = False

            if not exists:
                schema_path = Path(PG_SCHEMA_FILE)
                if not schema_path.exists():
                    raise RuntimeError(f"PG_SCHEMA_FILE not found: {schema_path.resolve()}")

                schema_sql = schema_path.read_text(encoding="utf-8")
                cur.execute(schema_sql)
                conn.commit()
                schema_applied = True

            # Seed only if empty and seed file exists
            cur.execute("SELECT COUNT(*) AS count FROM documents")
            count = cur.fetchone()["count"]
            seed_path = Path(PG_SEED_FILE)
            if count == 0 and seed_path.exists():
                seed_sql = seed_path.read_text(encoding="utf-8")
                cur.execute(seed_sql)
                conn.commit()

            _SCHEMA_READY = True
        finally:
            if conn:
                conn.close()


# ---------------------------------------------------------------------
# Business logic (ported from FastAPI main.py)
# ---------------------------------------------------------------------

async def _get_latest_version(document_id: str) -> Optional[Dict[str, Any]]:
    return _db_get(
        """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber",
                  islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                  status, storageref AS "storageRef", notes
           FROM document_versions
           WHERE documentid = %s AND islatest = TRUE
           LIMIT 1""",
        (document_id,),
    )


async def _get_version_by_number(document_id: str, version_number: int) -> Optional[Dict[str, Any]]:
    return _db_get(
        """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber",
                  islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                  status, storageref AS "storageRef", notes
           FROM document_versions
           WHERE documentid = %s AND versionnumber = %s
           LIMIT 1""",
        (document_id, version_number),
    )


def _normalize_value(row: Dict[str, Any]) -> str:
    corrected = (row.get("correctedValue") or "").strip()
    return corrected if corrected else (row.get("extractedValue") or "").strip()


async def _compute_changed_in_version_number(document_id: str) -> Dict[str, Any]:
    latest = await _get_latest_version(document_id)
    up_to = latest.get("versionNumber", 1) if latest else 1

    rows = _db_all(
        """
        SELECT dv.versionnumber AS "versionNumber",
               ef.attribute_key AS "attributeKey",
               ef.field_value AS "extractedValue",
               ef.corrected_value AS "correctedValue"
        FROM extracted_fields ef
        JOIN document_versions dv ON dv.id = ef.version_id
        WHERE ef.document_id = %s AND dv.versionnumber <= %s
        ORDER BY ef.attribute_key ASC, dv.versionnumber ASC
        """,
        (document_id, up_to),
    )

    by_attr: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        key = r["attributeKey"]
        by_attr.setdefault(key, []).append({"v": r["versionNumber"], "value": _normalize_value(r)})

    changed_in: Dict[str, int] = {}
    for attr_key, seq in by_attr.items():
        if not seq:
            continue
        last_changed = seq[0]["v"]
        prev = seq[0]["value"]
        for i in range(1, len(seq)):
            if seq[i]["value"] != prev:
                last_changed = seq[i]["v"]
                prev = seq[i]["value"]
        changed_in[attr_key] = last_changed

    return {"changedIn": changed_in, "latestVersionNumber": up_to}


# ---------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------

async def _handle_health(req: func.HttpRequest) -> func.HttpResponse:
    return _json_response(
        {
            "ok": True,
            "database": "PostgreSQL",
            "host": DB_HOST,
            "dbname": DB_NAME,
            "port": DB_PORT,
        }
    )


async def _handle_get_documents(req: func.HttpRequest) -> func.HttpResponse:
    docs = _db_all(
        """SELECT id, title, uploadedat AS "uploadDate",
                  status, currentversionid AS "currentVersionId", currentversionnumber AS "currentVersionNumber",
                  storageref AS "storageRef", attributecount AS "attributeCount",
                  overallconfidence AS "overallConfidence", reviewedby AS "reviewedBy"
           FROM documents
           ORDER BY uploadedat DESC
           LIMIT 1000"""
    )
    payload = [{**doc, "storageUrl": _to_storage_url(req, doc.get("storageRef"))} for doc in docs]
    return _json_response(payload)


async def _handle_get_document(req: func.HttpRequest, document_id: str) -> func.HttpResponse:
    doc = _db_get(
        """SELECT id, title, uploadedat AS "uploadDate",
                  status, currentversionid AS "currentVersionId", currentversionnumber AS "currentVersionNumber",
                  storageref AS "storageRef", attributecount AS "attributeCount",
                  overallconfidence AS "overallConfidence", reviewedby AS "reviewedBy"
           FROM documents
           WHERE id = %s""",
        (document_id,),
    )
    if not doc:
        return _error(404, "Document not found", code="not_found")

    versions = _db_all(
        """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber",
                  islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                  status, storageref AS "storageRef", notes
           FROM document_versions
           WHERE documentid = %s
           ORDER BY versionnumber DESC""",
        (document_id,),
    )

    payload = {
        **doc,
        "storageUrl": _to_storage_url(req, doc.get("storageRef")),
        "versions": [{**v, "storageUrl": _to_storage_url(req, v.get("storageRef"))} for v in versions],
    }
    return _json_response(payload)


async def _handle_get_versions(req: func.HttpRequest, document_id: str) -> func.HttpResponse:
    versions = _db_all(
        """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber",
                  islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                  status, storageref AS "storageRef", notes
           FROM document_versions
           WHERE documentid = %s
           ORDER BY versionnumber DESC""",
        (document_id,),
    )
    payload = [{**v, "storageUrl": _to_storage_url(req, v.get("storageRef"))} for v in versions]
    return _json_response(payload)


async def _handle_get_attributes(req: func.HttpRequest, document_id: str) -> func.HttpResponse:
    version = (req.params.get("version") or "latest").strip()
    include_version = (req.params.get("includeVersion") or "1").strip().lower()

    version_param = version.lower()
    if version_param == "latest":
        requested_version = await _get_latest_version(document_id)
    else:
        try:
            requested_version = await _get_version_by_number(document_id, int(version_param))
        except ValueError:
            return _error(400, "version must be 'latest' or an integer", code="bad_request")

    if not requested_version:
        return _error(404, "Version not found", code="not_found")

    change_data = await _compute_changed_in_version_number(document_id)
    changed_in = change_data["changedIn"]
    latest_version_number = change_data["latestVersionNumber"]

    rows = _db_all(
        """
        SELECT
            row_id AS "rowId",
            attribute_key AS id,
            document_id AS "documentId",
            version_id AS "versionId",
            field_name AS name,
            category,
            section,
            page_number AS page,
            confidence_score AS "confidenceScore",
            confidence_level AS "confidenceLevel",
            field_value AS "extractedValue",
            corrected_value AS "correctedValue",
            highlighted_text AS "highlightedText",
            bounding_box AS "boundingBox"
        FROM extracted_fields
        WHERE document_id = %s AND version_id = %s
        ORDER BY attribute_key
        """,
        (document_id, requested_version["id"]),
    )

    payload_attributes = [
        {
            **attr,
            "changedInVersionNumber": changed_in.get(attr["id"], 1),
            "latestVersionNumber": latest_version_number,
        }
        for attr in rows
    ]

    include_flag = include_version in ("1", "true", "yes")
    if not include_flag:
        return _json_response(payload_attributes)

    payload = {
        "documentId": document_id,
        "effectiveVersionNumber": requested_version["versionNumber"],
        "latestVersionNumber": latest_version_number,
        "version": {
            "id": requested_version["id"],
            "versionNumber": requested_version["versionNumber"],
            "isLatest": requested_version["isLatest"],
            "status": requested_version["status"],
            "createdAt": requested_version["createdAt"],
            "storageRef": requested_version.get("storageRef"),
            "storageUrl": _to_storage_url(req, requested_version.get("storageRef")),
        },
        "attributes": payload_attributes,
    }
    return _json_response(payload)


async def _handle_export_attributes(req: func.HttpRequest, document_id: str) -> func.HttpResponse:
    format_param = (req.params.get("format") or "csv").strip().lower()
    version = (req.params.get("version") or "latest").strip().lower()

    if version == "latest":
        doc_version = await _get_latest_version(document_id)
    else:
        try:
            doc_version = await _get_version_by_number(document_id, int(version))
        except ValueError:
            return _error(400, "version must be 'latest' or an integer", code="bad_request")

    if not doc_version:
        return _error(404, "Version not found", code="not_found")

    rows = _db_all(
        """
        SELECT
            attribute_key AS id,
            field_name AS name,
            category,
            section,
            page_number AS page,
            confidence_score AS "confidenceScore",
            confidence_level AS "confidenceLevel",
            field_value AS "extractedValue",
            corrected_value AS "correctedValue"
        FROM extracted_fields
        WHERE document_id = %s AND version_id = %s
        ORDER BY attribute_key
        """,
        (document_id, doc_version["id"]),
    )

    if format_param == "json":
        return _json_response(rows)

    # CSV export
    def escape_csv(value: Any) -> str:
        s = str(value if value is not None else "")
        return f"\"{s.replace(chr(34), chr(34) + chr(34))}\""

    headers = [
        "Attribute ID",
        "Name",
        "Category",
        "Section",
        "Page",
        "Confidence",
        "Extracted Value",
        "Corrected Value",
    ]

    csv_rows: List[List[str]] = []
    for attr in rows:
        csv_rows.append(
            [
                str(attr.get("id") or ""),
                escape_csv(attr.get("name")),
                escape_csv(attr.get("category")),
                escape_csv(attr.get("section")),
                str(attr.get("page") or ""),
                str(attr.get("confidenceScore") or ""),
                escape_csv(attr.get("extractedValue")),
                escape_csv(attr.get("correctedValue")),
            ]
        )

    csv_content = ",".join(headers) + "\n" + "\n".join(",".join(r) for r in csv_rows)

    return _text_response(
        csv_content,
        status=200,
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{document_id}_v{doc_version["versionNumber"]}.csv"'},
    )


async def _handle_save_review(req: func.HttpRequest, document_id: str) -> func.HttpResponse:
    try:
        payload = req.get_json()
    except ValueError:
        return _error(400, "Invalid JSON body", code="bad_request")

    version_number = payload.get("versionNumber")
    reviewed_by = payload.get("reviewedBy") or "web"
    status = payload.get("status") or "Reviewed"
    attributes = payload.get("attributes") or []

    if not isinstance(attributes, list):
        return _error(400, "attributes must be a list", code="bad_request")

    # Determine target version
    if version_number is not None:
        try:
            version = await _get_version_by_number(document_id, int(version_number))
        except ValueError:
            return _error(400, "versionNumber must be an integer", code="bad_request")
    else:
        version = await _get_latest_version(document_id)

    if not version:
        return _error(404, "Version not found", code="not_found")

    conn = None
    review_id = None

    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("BEGIN")

        # Create review session
        cur.execute(
            """
            INSERT INTO review_sessions
            (document_id, target_version_id, reviewer, status, created_at, updated_at)
            VALUES (%s, %s, %s, 'COMPLETED', NOW(), NOW())
            RETURNING review_id
            """,
            (document_id, version["id"], reviewed_by),
        )
        review_session = cur.fetchone()
        review_id = review_session["review_id"] if review_session else None

        # Update each attribute + audit
        for attr in attributes:
            if not isinstance(attr, dict):
                continue
            attr_id = attr.get("id")
            if not attr_id:
                continue

            row_id = attr.get("rowId") or f"{attr_id}--{version['id']}"
            new_corrected_value = attr.get("correctedValue")

            # Existing corrected value
            cur.execute(
                "SELECT corrected_value FROM extracted_fields WHERE row_id = %s AND version_id = %s",
                (row_id, version["id"]),
            )
            existing = cur.fetchone()
            old_corrected_value = existing["corrected_value"] if existing else None

            # Original extracted value
            cur.execute(
                "SELECT field_value FROM extracted_fields WHERE row_id = %s AND version_id = %s",
                (row_id, version["id"]),
            )
            original = cur.fetchone()
            original_value = original["field_value"] if original else None

            # Update corrected value
            cur.execute(
                "UPDATE extracted_fields SET corrected_value = %s WHERE row_id = %s AND version_id = %s",
                (new_corrected_value, row_id, version["id"]),
            )

            # Audit trail
            cur.execute(
                """
                INSERT INTO reviewed_fields
                (review_id, document_id, target_version_id, attribute_key,
                 original_value, old_corrected_value, new_corrected_value, corrected_value,
                 approved, reviewed_by, reviewed_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s, NOW(), NOW())
                """,
                (
                    review_id,
                    document_id,
                    version["id"],
                    attr_id,
                    original_value,
                    old_corrected_value,
                    new_corrected_value,
                    new_corrected_value,
                    reviewed_by,
                ),
            )

        # Update document status (and optionally storageRef)
        cur.execute(
            "UPDATE documents SET status = %s, reviewedby = %s, storageref = %s WHERE id = %s",
            (status, reviewed_by, version.get("storageRef"), document_id),
        )

        conn.commit()

    except Exception as exc:
        if conn:
            conn.rollback()
        return _error(500, f"Failed to save review: {exc}", code="internal_error")
    finally:
        if conn:
            conn.close()

    # Conga postback (after DB commit)
    conga_client = get_conga_client()
    conga_payload = {
        "documentId": document_id,
        "versionId": version["id"],
        "versionNumber": version["versionNumber"],
        "reviewedBy": reviewed_by,
        "status": status,
        "reviewSessionId": str(review_id) if review_id else None,
        "attributes": [
            {"id": a.get("id"), "rowId": a.get("rowId") or f"{a.get('id')}--{version['id']}", "correctedValue": a.get("correctedValue")}
            for a in attributes
            if isinstance(a, dict) and a.get("id")
        ],
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Default behavior matches FastAPI: "queued" (non-blocking).
    # In real production, prefer a queue/service-bus/durable activity for guaranteed delivery.
    if conga_client.enabled:
        if CONGA_CALL_MODE == "sync":
            try:
                await conga_client.post_review(conga_payload)
            except Exception:
                # Don't fail the user save if Conga post fails; keep it best-effort here.
                pass
        else:
            try:
                asyncio.create_task(conga_client.post_review(conga_payload))
            except RuntimeError:
                # No running loop; last resort
                try:
                    asyncio.run(conga_client.post_review(conga_payload))
                except Exception:
                    pass

    return _json_response(
        {
            "success": True,
            "documentId": document_id,
            "versionId": version["id"],
            "versionNumber": version["versionNumber"],
            "reviewSessionId": str(review_id) if review_id else None,
            "fieldsUpdated": len([a for a in attributes if isinstance(a, dict) and a.get("id")]),
            "conga": {"queued": True, "enabled": conga_client.enabled, "mock": conga_client.mock},
        }
    )


# ---------------------------------------------------------------------
# Main Azure Functions entrypoint (HTTP Trigger)
# ---------------------------------------------------------------------

_ROUTE_DOCS = re.compile(r"^/api/documents/?$")
_ROUTE_DOC = re.compile(r"^/api/documents/([^/]+)/?$")
_ROUTE_VERSIONS = re.compile(r"^/api/documents/([^/]+)/versions/?$")
_ROUTE_ATTRS = re.compile(r"^/api/documents/([^/]+)/attributes/?$")
_ROUTE_EXPORT = re.compile(r"^/api/documents/([^/]+)/attributes/export/?$")
_ROUTE_REVIEW = re.compile(r"^/api/documents/([^/]+)/review/?$")


async def main(req: func.HttpRequest) -> func.HttpResponse:
    # CORS preflight
    if req.method.upper() == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_with_cors_headers())

    await _ensure_schema_if_enabled()

    path = _get_path(req)

    # Health
    if req.method.upper() == "GET" and path.rstrip("/") == "/health":
        return await _handle_health(req)

    # Documents list
    if req.method.upper() == "GET" and _ROUTE_DOCS.match(path):
        return await _handle_get_documents(req)

    # Document details (and versions)
    m = _ROUTE_DOC.match(path)
    if req.method.upper() == "GET" and m:
        return await _handle_get_document(req, m.group(1))

    # Versions
    m = _ROUTE_VERSIONS.match(path)
    if req.method.upper() == "GET" and m:
        return await _handle_get_versions(req, m.group(1))

    # Attributes
    m = _ROUTE_ATTRS.match(path)
    if req.method.upper() == "GET" and m:
        return await _handle_get_attributes(req, m.group(1))

    # Export attributes
    m = _ROUTE_EXPORT.match(path)
    if req.method.upper() == "GET" and m:
        return await _handle_export_attributes(req, m.group(1))

    # Save review
    m = _ROUTE_REVIEW.match(path)
    if req.method.upper() == "POST" and m:
        return await _handle_save_review(req, m.group(1))

    return _error(404, f"No route for {req.method} {path}", code="not_found")
