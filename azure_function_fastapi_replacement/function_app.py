"""
Azure Functions App - Contract AI Orchestrator
Modern Python v2 programming model
"""

import azure.functions as func
import json
import logging
import os
import re
import asyncio
import psycopg2
import psycopg2.extras
import uuid
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
from pathlib import Path

# Import Conga client (optional)
try:
    from conga_client import get_conga_client
    CONGA_AVAILABLE = True
except ImportError:
    CONGA_AVAILABLE = False
    logging.warning("conga_client not available")

# ---------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "contract_ai_postgres_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")

AUTO_INIT_DB = os.getenv("AUTO_INIT_DB", "false").lower() in ("1", "true", "yes")
CONGA_CALL_MODE = os.getenv("CONGA_CALL_MODE", "async").lower()
CORS_ALLOW_ORIGIN = os.getenv("CORS_ALLOW_ORIGIN", "*")

_SCHEMA_READY = False
_SCHEMA_LOCK = asyncio.Lock()

# Create the function app
app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

# ---------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------

def _json_serializer(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    if isinstance(value, timedelta):
        return str(value)
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


def _to_storage_url(req: func.HttpRequest, storage_ref: Optional[str]) -> Optional[str]:
    """Convert storageRef to full URL."""
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
# PostgreSQL helpers
# ---------------------------------------------------------------------

def _get_conn():
    # Azure PostgreSQL requires SSL
    conn_params = {
        'host': DB_HOST,
        'port': DB_PORT,
        'dbname': DB_NAME,
        'user': DB_USER,
        'password': DB_PASSWORD,
        'cursor_factory': psycopg2.extras.RealDictCursor,
    }
    
    # Add SSL for Azure PostgreSQL (if host contains 'postgres.database.azure.com')
    if 'postgres.database.azure.com' in DB_HOST:
        conn_params['sslmode'] = 'require'
    
    return psycopg2.connect(**conn_params)


def _db_get(sql: str, params: Optional[Tuple[Any, ...]] = None) -> Optional[Dict[str, Any]]:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()
    finally:
        conn.close()


def _db_all(sql: str, params: Optional[Tuple[Any, ...]] = None) -> List[Dict[str, Any]]:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


def _db_execute(sql: str, params: Optional[Tuple[Any, ...]] = None) -> None:
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
    finally:
        conn.close()


def _log_conga_postback(document_id: str, version_id: str, result: Dict[str, Any]) -> None:
    """Log Conga postback attempt to database."""
    try:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO conga_postback_logs 
                       (document_id, version_id, endpoint, payload, status_code, response_body)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (
                        document_id,
                        version_id,
                        result.get("endpoint"),
                        json.dumps(result.get("payload", {})),
                        result.get("status_code"),
                        result.get("response_body")
                    )
                )
            conn.commit()
            logging.info(f"Logged Conga postback for {document_id} (status: {result.get('status_code')})")
        except Exception as e:
            conn.rollback()
            logging.error(f"Failed to log Conga postback: {e}")
        finally:
            conn.close()
    except Exception as e:
        logging.error(f"Database connection error when logging Conga postback: {e}")


# ---------------------------------------------------------------------
# Business logic
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
    """
    Compute the version number where each attribute last changed.
    
    For each attribute_key, compare the effective value (corrected or extracted)
    with the previous version. Return the highest version where a change occurred.
    """
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
    
    # Group by attribute key
    by_attr: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        key = r["attributeKey"]
        by_attr.setdefault(key, []).append(r)
    
    changed_in: Dict[str, int] = {}
    for attr_key, seq in by_attr.items():
        if len(seq) < 2:
            # Only one version exists, changed in v1
            changed_in[attr_key] = 1
            continue
        
        # Track the most recent version where value changed vs previous
        changed_version = 1  # Default: changed in v1
        prev_val = _normalize_value(seq[0])
        
        for i in range(1, len(seq)):
            curr_val = _normalize_value(seq[i])
            if curr_val != prev_val:
                # Value changed in this version
                changed_version = seq[i]["versionNumber"]
            prev_val = curr_val  # Update for next comparison
        
        changed_in[attr_key] = changed_version
    
    return {"changedIn": changed_in, "latestVersionNumber": up_to}


# ---------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------

@app.route(route="api/health", methods=["GET", "OPTIONS"])
async def health(req: func.HttpRequest) -> func.HttpResponse:
    """Health check endpoint"""
    if req.method == "OPTIONS":
        return _json_response({}, status=200)
    
    try:
        # Test database connection
        conn = _get_conn()
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return _json_response({
        "ok": True,
        "database": "PostgreSQL",
        "dbStatus": db_status,
        "host": DB_HOST,
        "dbname": DB_NAME,
        "port": DB_PORT,
    })


@app.route(route="api/documents", methods=["GET", "OPTIONS"])
async def get_documents(req: func.HttpRequest) -> func.HttpResponse:
    """Get all documents"""
    if req.method == "OPTIONS":
        return _json_response({}, status=200)
    
    try:
        docs = _db_all(
            """SELECT id, title, uploadedat AS "uploadDate",
                      status, currentversionid AS "currentVersionId", 
                      currentversionnumber AS "currentVersionNumber",
                      storageref AS "storageRef", attributecount AS "attributeCount",
                      overallconfidence AS "overallConfidence", reviewedby AS "reviewedBy"
               FROM documents
               ORDER BY uploadedat DESC
               LIMIT 1000"""
        )
        payload = [{**doc, "storageUrl": _to_storage_url(req, doc.get("storageRef"))} for doc in docs]
        return _json_response(payload)
    except Exception as e:
        logging.error(f"Error getting documents: {e}")
        return _error(500, str(e))


@app.route(route="api/documents/{document_id}", methods=["GET", "OPTIONS"])
async def get_document(req: func.HttpRequest) -> func.HttpResponse:
    """Get single document with versions"""
    if req.method == "OPTIONS":
        return _json_response({}, status=200)
    
    document_id = req.route_params.get("document_id")
    
    try:
        doc = _db_get(
            """SELECT id, title, uploadedat AS "uploadDate",
                      status, currentversionid AS "currentVersionId", 
                      currentversionnumber AS "currentVersionNumber",
                      storageref AS "storageRef", attributecount AS "attributeCount",
                      overallconfidence AS "overallConfidence", reviewedby AS "reviewedBy"
               FROM documents
               WHERE id = %s""",
            (document_id,),
        )
        
        if not doc:
            return _error(404, "Document not found")
        
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
    except Exception as e:
        logging.error(f"Error getting document {document_id}: {e}")
        return _error(500, str(e))


@app.route(route="api/documents/{document_id}/versions", methods=["GET", "OPTIONS"])
async def get_versions(req: func.HttpRequest) -> func.HttpResponse:
    """Get document versions"""
    if req.method == "OPTIONS":
        return _json_response({}, status=200)
    
    document_id = req.route_params.get("document_id")
    
    try:
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
    except Exception as e:
        logging.error(f"Error getting versions for document {document_id}: {e}")
        return _error(500, str(e))


@app.route(route="api/documents/{document_id}/attributes", methods=["GET", "OPTIONS"])
async def get_attributes(req: func.HttpRequest) -> func.HttpResponse:
    """Get document attributes"""
    if req.method == "OPTIONS":
        return _json_response({}, status=200)
    
    document_id = req.route_params.get("document_id")
    version = req.params.get("version", "latest").strip()
    include_version = req.params.get("includeVersion", "1").strip().lower()
    
    try:
        # Get requested version
        if version.lower() == "latest":
            requested_version = await _get_latest_version(document_id)
        else:
            try:
                vnum = int(version)
                requested_version = await _get_version_by_number(document_id, vnum)
            except ValueError:
                return _error(400, "Invalid version parameter")
        
        if not requested_version:
            return _error(404, "Version not found")
        
        # Get change tracking data
        change_data = await _compute_changed_in_version_number(document_id)
        changed_in = change_data["changedIn"]
        
        # Get attributes for this version
        attrs = _db_all(
            """SELECT ef.field_id AS id, ef.row_id AS "rowId",
                      ef.attribute_key AS "attributeKey",
                      ef.field_name AS name,
                      ef.category, ef.section,
                      ef.field_value AS "extractedValue",
                      ef.corrected_value AS "correctedValue",
                      ef.confidence_score AS "confidenceScore",
                      ef.confidence_level AS "confidenceLevel",
                      ef.page_number AS page,
                      ef.highlighted_text AS "highlightedText",
                      ef.bounding_box AS "boundingBox"
               FROM extracted_fields ef
               WHERE ef.version_id = %s
               ORDER BY ef.attribute_key ASC""",
            (requested_version["id"],),
        )
        
        # Build response
        attributes = []
        for attr in attrs:
            key = attr["attributeKey"]
            obj = {
                "id": str(attr["id"]),
                "rowId": attr["rowId"],
                "attributeKey": key,
                "name": attr.get("name", key),
                "category": attr.get("category", "General"),
                "section": attr.get("section", "Default"),
                "extractedValue": attr["extractedValue"],
                "correctedValue": attr["correctedValue"],
                "confidenceScore": attr.get("confidenceScore", 0),
                "confidenceLevel": attr.get("confidenceLevel", "low"),
                "page": attr.get("page", 1),
                "highlightedText": attr.get("highlightedText"),
                "boundingBox": attr.get("boundingBox"),
                "changedInVersionNumber": changed_in.get(key, 1),
            }
            attributes.append(obj)
        
        payload = {"attributes": attributes}
        
        if include_version in ("1", "true", "yes"):
            payload["version"] = {
                **requested_version,
                "storageUrl": _to_storage_url(req, requested_version.get("storageRef"))
            }
        
        return _json_response(payload)
    except Exception as e:
        logging.error(f"Error getting attributes for document {document_id}: {e}")
        return _error(500, str(e))


@app.route(route="api/documents/{document_id}/attributes/export", methods=["GET", "OPTIONS"])
async def export_attributes(req: func.HttpRequest) -> func.HttpResponse:
    """Export attributes in CSV or JSON format"""
    if req.method == "OPTIONS":
        return _json_response({}, status=200)
    
    document_id = req.route_params.get("document_id")
    format_type = req.params.get("format", "csv").lower()
    version = req.params.get("version", "latest").strip()
    
    try:
        # Get requested version
        if version.lower() == "latest":
            requested_version = await _get_latest_version(document_id)
        else:
            try:
                vnum = int(version)
                requested_version = await _get_version_by_number(document_id, vnum)
            except ValueError:
                return _error(400, "Invalid version parameter")
        
        if not requested_version:
            return _error(404, "Version not found")
        
        # Get attributes
        attrs = _db_all(
            """SELECT ef.attribute_key AS "attributeKey",
                      ef.field_value AS "extractedValue",
                      ef.corrected_value AS "correctedValue",
                      ef.confidence_score AS "confidenceScore"
               FROM extracted_fields ef
               WHERE ef.version_id = %s
               ORDER BY ef.attribute_key ASC""",
            (requested_version["id"],),
        )
        
        if format_type == "json":
            export_data = [
                {
                    "attributeKey": a["attributeKey"],
                    "extractedValue": a["extractedValue"],
                    "correctedValue": a["correctedValue"],
                    "confidenceScore": a["confidenceScore"],
                }
                for a in attrs
            ]
            return _json_response(export_data)
        
        elif format_type == "csv":
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Attribute Key", "Extracted Value", "Corrected Value", "Confidence"])
            
            for a in attrs:
                writer.writerow([
                    a["attributeKey"],
                    a["extractedValue"] or "",
                    a["correctedValue"] or "",
                    a["confidenceScore"] or "",
                ])
            
            return _text_response(
                output.getvalue(),
                mimetype="text/csv",
                headers={"Content-Disposition": f'attachment; filename="attributes_{document_id}.csv"'}
            )
        
        else:
            return _error(400, "Invalid format. Use 'csv' or 'json'")
    
    except Exception as e:
        logging.error(f"Error exporting attributes for document {document_id}: {e}")
        return _error(500, str(e))


@app.route(route="api/documents/{document_id}/review", methods=["POST", "OPTIONS"])
async def save_review(req: func.HttpRequest) -> func.HttpResponse:
    """Save review changes and create new version"""
    if req.method == "OPTIONS":
        return _json_response({}, status=200)
    
    document_id = req.route_params.get("document_id")
    
    try:
        body = req.get_json()
    except ValueError:
        return _error(400, "Invalid JSON body")
    
    logging.info(f"Save review payload keys: {list(body.keys())}")
    
    # Accept corrections by attributeKey (stable across versions)
    corrections_by_key = {}
    attributes_list = body.get("attributes", [])
    reviewer_name = body.get("reviewerName", "unknown")
    notes = body.get("notes", "")
    
    # Build corrections map
    if body.get("corrections"):
        # Direct corrections object (preferred)
        corrections_by_key = body.get("corrections", {})
        logging.info(f"Using direct corrections: {len(corrections_by_key)} items")
    elif attributes_list:
        # Attributes list - prefer attributeKey if present
        for attr in attributes_list:
            attr_key = attr.get("attributeKey")
            corrected_val = attr.get("correctedValue")
            
            if attr_key:
                # Direct attributeKey provided (stable)
                corrections_by_key[attr_key] = corrected_val if corrected_val is not None else ""
                logging.info(f"Mapped by attributeKey: {attr_key} = '{corrected_val}'")
            else:
                # Fallback: map by ID (version-specific, less reliable)
                current_latest = await _get_latest_version(document_id)
                if current_latest:
                    existing_attrs = _db_all(
                        """SELECT field_id::text as id, attribute_key 
                           FROM extracted_fields 
                           WHERE version_id = %s""",
                        (current_latest["id"],)
                    )
                    id_to_key = {a["id"]: a["attribute_key"] for a in existing_attrs}
                    attr_id = attr.get("id", "")
                    attr_key = id_to_key.get(attr_id)
                    if attr_key:
                        corrections_by_key[attr_key] = corrected_val if corrected_val is not None else ""
                        logging.info(f"Mapped by ID fallback: {attr_id} -> {attr_key} = '{corrected_val}'")
    
    logging.info(f"Save review for {document_id}: {len(corrections_by_key)} corrections")
    
    try:
        # ALWAYS get the current latest version (regardless of which version user is viewing)
        current_latest = await _get_latest_version(document_id)
        if not current_latest:
            return _error(404, "Document has no versions")
        
        latest_version_id = current_latest["id"]
        latest_version_num = current_latest["versionNumber"]
        
        logging.info(f"Current latest version: {latest_version_id} (v{latest_version_num})")
        
        # Instead of creating a new version, UPDATE the latest version's attributes
        # This allows corrections from any viewed version to update the latest
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                # Update corrected_value for each attribute in the latest version
                # Allow empty values (to clear corrections)
                update_count = 0
                updated_keys = []
                
                for attr_key, corrected_val in corrections_by_key.items():
                    # Update even if empty (allows clearing values)
                    # Handle empty string vs None - both should clear the value
                    db_value = corrected_val if corrected_val else None
                    cur.execute(
                        """UPDATE extracted_fields
                           SET corrected_value = %s
                           WHERE document_id = %s 
                             AND version_id = %s 
                             AND attribute_key = %s""",
                        (db_value, document_id, latest_version_id, attr_key)
                    )
                    if cur.rowcount > 0:
                        update_count += 1
                        updated_keys.append(attr_key)
                        logging.info(f"Updated {attr_key} in v{latest_version_num}: '{corrected_val}'")
                    else:
                        logging.warning(f"No row found for {attr_key} in {latest_version_id}")
                
                # Update document status
                cur.execute(
                    """UPDATE documents 
                       SET status = 'Reviewed',
                           reviewedby = %s
                       WHERE id = %s""",
                    (reviewer_name, document_id)
                )
                
                conn.commit()
                logging.info(f"Successfully updated {update_count} attributes in version {latest_version_num}")
                
                # Send to Conga and log to database
                conga_result = None
                if CONGA_AVAILABLE:
                    try:
                        conga_client = get_conga_client()
                        
                        # Call Conga (sync or async based on config)
                        if CONGA_CALL_MODE == "async":
                            # Fire and forget - log will happen in background
                            async def send_and_log():
                                try:
                                    result = await conga_client.send_review_async(
                                        document_id, latest_version_id, corrections_by_key, reviewer_name
                                    )
                                    _log_conga_postback(document_id, latest_version_id, result)
                                except Exception as e:
                                    logging.error(f"Async Conga send failed: {e}")
                                    _log_conga_postback(document_id, latest_version_id, {
                                        "success": False,
                                        "error": str(e),
                                        "endpoint": None,
                                        "payload": {"documentId": document_id, "versionId": latest_version_id},
                                        "status_code": None,
                                        "response_body": str(e)
                                    })
                            
                            asyncio.create_task(send_and_log())
                        else:
                            # Synchronous - wait for result and log immediately
                            conga_result = await conga_client.send_review_async(
                                document_id, latest_version_id, corrections_by_key, reviewer_name
                            )
                            _log_conga_postback(document_id, latest_version_id, conga_result)
                            
                    except Exception as conga_err:
                        logging.warning(f"Conga integration error: {conga_err}")
                        # Log the error
                        _log_conga_postback(document_id, latest_version_id, {
                            "success": False,
                            "error": str(conga_err),
                            "endpoint": None,
                            "payload": {"documentId": document_id, "versionId": latest_version_id},
                            "status_code": None,
                            "response_body": str(conga_err)
                        })
                
                return _json_response({
                    "ok": True,
                    "versionNumber": latest_version_num,
                    "versionId": latest_version_id,
                    "updatedCount": update_count,
                    "updatedKeys": updated_keys,
                    "congaResult": conga_result if conga_result else None,
                })
        
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    except Exception as e:
        logging.error(f"Error saving review for document {document_id}: {e}")
        return _error(500, str(e))


# ---------------------------------------------------------------------
# Static File Serving - PDF Documents
# ---------------------------------------------------------------------

@app.route(route="contracts/{*path}", methods=["GET", "OPTIONS"])
async def serve_static_files(req: func.HttpRequest) -> func.HttpResponse:
    """Serve static PDF files from public/contracts directory"""
    if req.method == "OPTIONS":
        return func.HttpResponse(
            status_code=200,
            headers=_with_cors_headers()
        )
    
    # Get the file path from route params
    file_path = req.route_params.get("path", "")
    
    # Security: prevent directory traversal
    if ".." in file_path or file_path.startswith("/"):
        return func.HttpResponse(
            "Invalid file path",
            status_code=400,
            headers=_with_cors_headers()
        )
    
    # Build full path to file (go up one level from function_app directory to workspace root)
    workspace_root = Path(__file__).parent.parent
    full_path = workspace_root / "public" / "contracts" / file_path
    
    logging.info(f"Attempting to serve file: {full_path}")
    
    # Check if file exists
    if not full_path.exists() or not full_path.is_file():
        logging.warning(f"File not found: {full_path}")
        return func.HttpResponse(
            "File not found",
            status_code=404,
            headers=_with_cors_headers()
        )
    
    # Read and return file
    try:
        with open(full_path, "rb") as f:
            file_content = f.read()
        
        # Determine content type
        content_type = "application/pdf" if full_path.suffix.lower() == ".pdf" else "application/octet-stream"
        
        return func.HttpResponse(
            body=file_content,
            status_code=200,
            mimetype=content_type,
            headers=_with_cors_headers({
                "Content-Disposition": f'inline; filename="{full_path.name}"'
            })
        )
    except Exception as e:
        logging.error(f"Error reading file {full_path}: {e}")
        return func.HttpResponse(
            f"Error reading file: {str(e)}",
            status_code=500,
            headers=_with_cors_headers()
        )


# ---------------------------------------------------------------------
# Timer Trigger - Runs every 5 minutes
# DISABLED for local development (requires Azure Storage Emulator)
# To enable: Uncomment the decorator and function, then start Azurite or use real storage
# ---------------------------------------------------------------------

# @app.timer_trigger(schedule="0 */5 * * * *", arg_name="mytimer", run_on_startup=False) 
# def timer_trigger_function(mytimer: func.TimerRequest) -> None:
#     """
#     Timer trigger that runs every 5 minutes.
#     Schedule format: "seconds minutes hours day month day-of-week"
#     Examples:
#       - "0 */5 * * * *"   = Every 5 minutes
#       - "0 0 * * * *"     = Every hour
#       - "0 0 0 * * *"     = Every day at midnight
#       - "0 30 9 * * 1-5"  = Weekdays at 9:30 AM
#     
#     Use this for:
#     - Checking for new documents to process
#     - Cleanup old/expired data
#     - Sync with external systems (Conga)
#     - Generate reports
#     - Health monitoring
#     """
#     utc_timestamp = datetime.utcnow().replace(
#         tzinfo=None
#     ).isoformat()
#     
#     if mytimer.past_due:
#         logging.info('Timer trigger is past due!')
#     
#     logging.info(f'Timer trigger executed at: {utc_timestamp}')
#     
#     try:
#         # Example: Check for pending documents
#         pending_docs = _db_all(
#             """SELECT id, title, status 
#                FROM documents 
#                WHERE status = 'pending' 
#                LIMIT 10"""
#         )
#         
#         if pending_docs:
#             logging.info(f'Found {len(pending_docs)} pending documents')
#             for doc in pending_docs:
#                 logging.info(f"  - Document {doc['id']}: {doc['title']}")
#         else:
#             logging.info('No pending documents found')
#         
#         # Example: Cleanup old versions (uncomment if needed)
#         # cleanup_result = _db_execute(
#         #     """DELETE FROM document_versions 
#         #        WHERE createdat < NOW() - INTERVAL '90 days' 
#         #        AND islatest = FALSE"""
#         # )
#         
#         logging.info('Timer trigger completed successfully')
#         
#     except Exception as e:
#         logging.error(f'Timer trigger error: {e}')
