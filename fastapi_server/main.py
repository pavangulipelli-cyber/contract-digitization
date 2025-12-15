# fastapi_server/main.py
# FastAPI server backed by SQLite with document + attribute versioning (tabs support)
#
# Works with:
# - GET /api/documents/:id/versions
# - GET /api/documents/:id/attributes?version=latest|<number>&includeVersion=1
# - Click attribute -> jump to changedInVersionNumber
# - Click version tab -> load attributes + PDF for that version

import os
import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import json

# =====================
# CONFIG
# =====================
PORT = int(os.getenv("PORT", "8000"))
DB_FILE = os.getenv("DB_FILE") or str(Path(__file__).parent / "data" / "contract_ai_versioned.db")
SEED_FILE = os.getenv("SEED_FILE") or str(Path(__file__).parent / "data" / "contract_ai_seed_versioned.sql")
CONTRACTS_DIR = os.getenv("CONTRACTS_DIR") or str(Path(__file__).parent.parent / "public" / "contracts")

# Ensure data directory exists
Path(DB_FILE).parent.mkdir(parents=True, exist_ok=True)

app = FastAPI()

# CORS - allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================
# DB helpers
# =====================
def get_db():
    """Open database connection with Row factory for dict-like access."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def db_get(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    """Execute query and return single row as dict."""
    conn = get_db()
    try:
        cursor = conn.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def db_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Execute query and return all rows as list of dicts."""
    conn = get_db()
    try:
        cursor = conn.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def db_run(sql: str, params: tuple = ()) -> Dict[str, int]:
    """Execute statement and return changes/lastrowid."""
    conn = get_db()
    try:
        cursor = conn.execute(sql, params)
        conn.commit()
        return {"changes": cursor.rowcount, "lastID": cursor.lastrowid}
    finally:
        conn.close()

def db_exec(sql: str):
    """Execute script (multiple statements)."""
    conn = get_db()
    try:
        conn.executescript(sql)
        conn.commit()
    finally:
        conn.close()

async def ensure_seeded():
    """Auto-create and seed database if tables don't exist."""
    # Ensure parent directory exists
    Path(DB_FILE).parent.mkdir(parents=True, exist_ok=True)
    
    # Connect to DB (SQLite will create file if missing)
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA foreign_keys = ON")
    
    try:
        # Check for required tables
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('documents', 'document_versions', 'attributes')"
        )
        existing_tables = {row[0] for row in cursor.fetchall()}
        required_tables = {'documents', 'document_versions', 'attributes'}
        missing_tables = required_tables - existing_tables
        
        seeded = False
        if missing_tables:
            # Tables are missing, seed the database
            if not Path(SEED_FILE).exists():
                raise RuntimeError(
                    f"Database tables missing but seed file not found at: {SEED_FILE}\n"
                    f"Missing tables: {', '.join(sorted(missing_tables))}"
                )
            
            print(f"⚠️  Missing tables: {', '.join(sorted(missing_tables))}")
            print(f"📦 Seeding database from: {SEED_FILE}")
            
            seed_sql = Path(SEED_FILE).read_text(encoding="utf-8")
            conn.executescript(seed_sql)
            conn.commit()
            seeded = True
            print(f"✅ Database seeded successfully")
        
        print(f"✅ DB ready: {DB_FILE} (seeded={seeded})")
        
    finally:
        conn.close()

def to_storage_url(request: Request, storage_ref: Optional[str]) -> Optional[str]:
    """Convert storageRef to full URL."""
    if not storage_ref:
        return None
    # Remove leading slashes
    ref = storage_ref.lstrip("/")
    return f"{request.url.scheme}://{request.headers.get('host')}/{ref}"

async def get_latest_version(document_id: str) -> Optional[Dict[str, Any]]:
    """Get latest version for document."""
    return db_get(
        "SELECT * FROM document_versions WHERE documentId = ? AND isLatest = 1 LIMIT 1",
        (document_id,)
    )

async def get_version_by_number(document_id: str, version_number: int) -> Optional[Dict[str, Any]]:
    """Get specific version by number."""
    return db_get(
        "SELECT * FROM document_versions WHERE documentId = ? AND versionNumber = ? LIMIT 1",
        (document_id, version_number)
    )

def normalize_value(row: Dict[str, Any]) -> str:
    """Get normalized value (correctedValue if present, else extractedValue)."""
    corrected = (row.get("correctedValue") or "").strip()
    return corrected if corrected else (row.get("extractedValue") or "").strip()

async def compute_changed_in_version_number(document_id: str) -> Dict[str, Any]:
    """Compute last changed version for each attribute."""
    latest = await get_latest_version(document_id)
    up_to = latest.get("versionNumber", 1) if latest else 1
    
    rows = db_all(
        """
        SELECT dv.versionNumber, a.attributeKey, a.extractedValue, a.correctedValue
        FROM attributes a
        JOIN document_versions dv ON dv.id = a.versionId
        WHERE a.documentId = ? AND dv.versionNumber <= ?
        ORDER BY a.attributeKey ASC, dv.versionNumber ASC
        """,
        (document_id, up_to)
    )
    
    # Group by attributeKey
    by_attr = {}
    for r in rows:
        key = r["attributeKey"]
        if key not in by_attr:
            by_attr[key] = []
        by_attr[key].append({"v": r["versionNumber"], "value": normalize_value(r)})
    
    # Find last changed version for each attribute
    changed_in = {}
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

# =====================
# MODELS
# =====================
class AttributeUpdate(BaseModel):
    id: str
    correctedValue: Optional[str] = None
    rowId: Optional[str] = None

class ReviewPayload(BaseModel):
    versionNumber: Optional[int] = None
    reviewedBy: Optional[str] = "web"
    status: Optional[str] = "Reviewed"
    attributes: List[AttributeUpdate]

# =====================
# ROUTES
# =====================
@app.get("/health")
async def health():
    return {
        "ok": True,
        "dbFile": DB_FILE,
        "port": PORT
    }

@app.get("/api/documents")
async def get_documents(request: Request):
    try:
        docs = db_all("SELECT * FROM documents ORDER BY uploadedAt DESC LIMIT 1000")
        return [
            {**doc, "storageUrl": to_storage_url(request, doc.get("storageRef"))}
            for doc in docs
        ]
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch documents")

@app.get("/api/documents/{document_id}")
async def get_document(document_id: str, request: Request):
    try:
        doc = db_get("SELECT * FROM documents WHERE id = ?", (document_id,))
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        versions = db_all(
            "SELECT * FROM document_versions WHERE documentId = ? ORDER BY versionNumber DESC",
            (document_id,)
        )
        
        return {
            **doc,
            "storageUrl": to_storage_url(request, doc.get("storageRef")),
            "versions": [
                {**v, "storageUrl": to_storage_url(request, v.get("storageRef"))}
                for v in versions
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch document")

@app.get("/api/documents/{document_id}/versions")
async def get_document_versions(document_id: str, request: Request):
    try:
        versions = db_all(
            "SELECT * FROM document_versions WHERE documentId = ? ORDER BY versionNumber DESC",
            (document_id,)
        )
        return [
            {**v, "storageUrl": to_storage_url(request, v.get("storageRef"))}
            for v in versions
        ]
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch versions")

@app.get("/api/documents/{document_id}/attributes")
async def get_attributes(
    document_id: str,
    request: Request,
    version: str = "latest",
    includeVersion: str = "1"
):
    try:
        # Determine requested version
        version_param = version.lower()
        if version_param == "latest":
            requested_version = await get_latest_version(document_id)
        else:
            requested_version = await get_version_by_number(document_id, int(version_param))
        
        if not requested_version:
            raise HTTPException(status_code=404, detail="Version not found")
        
        # Compute change metadata
        change_data = await compute_changed_in_version_number(document_id)
        changed_in = change_data["changedIn"]
        latest_version_number = change_data["latestVersionNumber"]
        
        # Fetch attributes for requested version
        rows = db_all(
            """
            SELECT
                id AS rowId,
                attributeKey AS id,
                documentId,
                versionId,
                name,
                category,
                section,
                page,
                confidenceScore,
                confidenceLevel,
                extractedValue,
                correctedValue,
                highlightedText
            FROM attributes
            WHERE documentId = ? AND versionId = ?
            ORDER BY attributeKey
            """,
            (document_id, requested_version["id"])
        )
        
        # Add change metadata to each attribute
        payload_attributes = [
            {
                **attr,
                "changedInVersionNumber": changed_in.get(attr["id"], 1),
                "latestVersionNumber": latest_version_number
            }
            for attr in rows
        ]
        
        # Check includeVersion flag
        include_version_flag = includeVersion.lower() in ("1", "true")
        
        if not include_version_flag:
            return payload_attributes
        
        return {
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
                "storageUrl": to_storage_url(request, requested_version.get("storageRef"))
            },
            "attributes": payload_attributes
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch attributes")

@app.get("/api/documents/{document_id}/attributes/export")
async def export_attributes(
    document_id: str,
    request: Request,
    format: str = "csv",
    version: str = "latest"
):
    try:
        # Determine version
        version_param = version.lower()
        if version_param == "latest":
            doc_version = await get_latest_version(document_id)
        else:
            doc_version = await get_version_by_number(document_id, int(version_param))
        
        if not doc_version:
            raise HTTPException(status_code=404, detail="Version not found")
        
        # Fetch attributes
        rows = db_all(
            """
            SELECT
                attributeKey AS id,
                name,
                category,
                section,
                page,
                confidenceScore,
                confidenceLevel,
                extractedValue,
                correctedValue
            FROM attributes
            WHERE documentId = ? AND versionId = ?
            ORDER BY attributeKey
            """,
            (document_id, doc_version["id"])
        )
        
        format_param = format.lower()
        
        if format_param == "json":
            return JSONResponse(
                content=rows,
                media_type="application/json"
            )
        
        # CSV export
        def escape_csv(value):
            """Escape CSV field with double quote escaping."""
            s = str(value if value is not None else "")
            return f'"{s.replace(chr(34), chr(34) + chr(34))}"'
        
        headers = [
            "Attribute ID",
            "Name",
            "Category",
            "Section",
            "Page",
            "Confidence",
            "Extracted Value",
            "Corrected Value"
        ]
        
        csv_rows = []
        for attr in rows:
            csv_rows.append([
                attr["id"],
                escape_csv(attr.get("name")),
                escape_csv(attr.get("category")),
                escape_csv(attr.get("section")),
                str(attr.get("page") or ""),
                str(attr.get("confidenceScore") or ""),
                escape_csv(attr.get("extractedValue")),
                escape_csv(attr.get("correctedValue"))
            ])
        
        csv_content = ",".join(headers) + "\n"
        csv_content += "\n".join(",".join(row) for row in csv_rows)
        
        return Response(
            content=csv_content,
            media_type="text/csv"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Export failed")

@app.post("/api/documents/{document_id}/review")
async def save_review(document_id: str, payload: ReviewPayload):
    conn = None
    try:
        # Determine version
        if payload.versionNumber is not None:
            version = await get_version_by_number(document_id, payload.versionNumber)
        else:
            version = await get_latest_version(document_id)
        
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        
        # Use transaction
        conn = get_db()
        conn.execute("BEGIN")
        
        for attr in payload.attributes:
            if not attr.id:
                continue
            
            attribute_key = attr.id
            row_id = attr.rowId or f"{attribute_key}--{version['id']}"
            
            # Get existing correctedValue
            existing = conn.execute(
                "SELECT correctedValue FROM attributes WHERE id = ? AND versionId = ?",
                (row_id, version["id"])
            ).fetchone()
            
            # Update correctedValue
            conn.execute(
                "UPDATE attributes SET correctedValue = ? WHERE id = ? AND versionId = ?",
                (attr.correctedValue, row_id, version["id"])
            )
            
            # Insert review record
            conn.execute(
                """
                INSERT INTO attribute_reviews 
                (documentId, versionId, attributeKey, oldCorrectedValue, newCorrectedValue, reviewedBy, reviewedAt)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                """,
                (
                    document_id,
                    version["id"],
                    attribute_key,
                    existing["correctedValue"] if existing else None,
                    attr.correctedValue,
                    payload.reviewedBy
                )
            )
        
        # Update document status
        conn.execute(
            "UPDATE documents SET status = ?, reviewedBy = ?, storageRef = ? WHERE id = ?",
            (payload.status, payload.reviewedBy, version.get("storageRef"), document_id)
        )
        
        conn.commit()
        
        return {
            "success": True,
            "documentId": document_id,
            "versionId": version["id"],
            "versionNumber": version["versionNumber"]
        }
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save review")
    finally:
        if conn:
            conn.close()

# =====================
# STARTUP
# =====================
@app.on_event("startup")
async def startup_event():
    await ensure_seeded()
    
    # Mount static files for PDFs
    if Path(CONTRACTS_DIR).exists():
        app.mount("/contracts", StaticFiles(directory=CONTRACTS_DIR), name="contracts")
        print(f"✅ Serving PDFs from: {CONTRACTS_DIR}")
    else:
        print(f"⚠️  CONTRACTS_DIR not found: {CONTRACTS_DIR}")
        print(f"   Set env var CONTRACTS_DIR to your UI's public/contracts folder so PDFs load.")
    
    print(f"✅ API server ready on http://localhost:{PORT}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
