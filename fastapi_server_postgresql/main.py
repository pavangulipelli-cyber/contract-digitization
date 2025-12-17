# fastapi_server_postgresql/main.py
# FastAPI server backed by PostgreSQL with document + attribute versioning (tabs support)
#
# Works with:
# - GET /api/documents/:id/versions
# - GET /api/documents/:id/attributes?version=latest|<number>&includeVersion=1
# - Click attribute -> jump to changedInVersionNumber
# - Click version tab -> load attributes + PDF for that version

import os
import psycopg2
import psycopg2.extras
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import PostgreSQL helpers
from db_pg import get_conn, db_get, db_all, db_run, db_exec

# Import Conga CLM client
from conga_client import get_conga_client

# =====================
# CONFIG
# =====================
PORT = int(os.getenv("PORT", "8000"))
PG_SCHEMA_FILE = os.getenv("PG_SCHEMA_FILE") or str(Path(__file__).parent / "data" / "contract_ai_schema_postgres_redesigned.sql")
CONTRACTS_DIR = os.getenv("CONTRACTS_DIR") or str(Path(__file__).parent.parent / "public" / "contracts")

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
# POSTGRESQL SCHEMA INITIALIZATION
# =====================
async def ensure_schema():
    """Auto-create PostgreSQL schema and seed data if tables don't exist or are empty."""
    conn = None
    try:
        print("=" * 60)
        print("🔌 Connecting to PostgreSQL...")
        print(f"   Host: {os.getenv('DB_HOST', 'localhost')}")
        print(f"   Port: {os.getenv('DB_PORT', '5432')}")
        print(f"   Database: {os.getenv('DB_NAME', 'contract_ai_postgres_db')}")
        print(f"   User: {os.getenv('DB_USER', 'postgres')}")
        print("=" * 60)
        
        conn = get_conn()
        cursor = conn.cursor()
        
        print("✅ PostgreSQL connection established!")
        
        # Check for required tables in information_schema
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('documents', 'document_versions', 'extracted_fields')
        """)
        
        existing_tables = {row['table_name'] for row in cursor.fetchall()}
        required_tables = {'documents', 'document_versions', 'extracted_fields'}
        missing_tables = required_tables - existing_tables
        
        print(f"📊 Existing tables: {sorted(existing_tables) if existing_tables else 'None'}")
        
        schema_applied = False
        if missing_tables:
            # Tables are missing, create schema
            if not Path(PG_SCHEMA_FILE).exists():
                raise RuntimeError(
                    f"Database tables missing but schema file not found at: {PG_SCHEMA_FILE}\n"
                    f"Missing tables: {', '.join(sorted(missing_tables))}"
                )
            
            print(f"⚠️  Missing tables: {', '.join(sorted(missing_tables))}")
            print(f"📦 Creating schema from: {PG_SCHEMA_FILE}")
            
            schema_sql = Path(PG_SCHEMA_FILE).read_text(encoding="utf-8")
            cursor.execute(schema_sql)
            conn.commit()
            schema_applied = True
            print(f"✅ Schema created successfully")
        
        # Check if data needs to be seeded
        seed_file = os.getenv("PG_SEED_FILE", "./data/contract_ai_seed_postgres_redesigned_updated.sql")
        if existing_tables:
            cursor.execute("SELECT COUNT(*) as count FROM documents")
            doc_count = cursor.fetchone()['count']
            
            if doc_count == 0 and Path(seed_file).exists():
                print(f"📦 Database is empty. Seeding demo data from: {seed_file}")
                seed_sql = Path(seed_file).read_text(encoding="utf-8")
                cursor.execute(seed_sql)
                conn.commit()
                print(f"✅ Demo data seeded successfully")
                cursor.execute("SELECT COUNT(*) as count FROM documents")
                new_count = cursor.fetchone()['count']
                print(f"📊 Documents in database: {new_count}")
            elif doc_count > 0:
                print(f"📊 Documents in database: {doc_count} (seed skipped)")
        
        print(f"✅ DB ready: PostgreSQL (schemaApplied={schema_applied})")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Database initialization error: {e}")
        raise
    finally:
        if conn:
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
        """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber", 
                  islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                  status, storageref AS "storageRef", notes
           FROM document_versions 
           WHERE documentid = %s AND islatest = TRUE 
           LIMIT 1""",
        (document_id,)
    )

async def get_version_by_number(document_id: str, version_number: int) -> Optional[Dict[str, Any]]:
    """Get specific version by number."""
    return db_get(
        """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber",
                  islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                  status, storageref AS "storageRef", notes
           FROM document_versions 
           WHERE documentid = %s AND versionnumber = %s 
           LIMIT 1""",
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
        SELECT dv.versionnumber AS "versionNumber", ef.attribute_key AS "attributeKey", 
               ef.field_value AS "extractedValue", ef.corrected_value AS "correctedValue"
        FROM extracted_fields ef
        JOIN document_versions dv ON dv.id = ef.version_id
        WHERE ef.document_id = %s AND dv.versionnumber <= %s
        ORDER BY ef.attribute_key ASC, dv.versionnumber ASC
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
    print("🏥 Health check - PostgreSQL backend")
    return {
        "ok": True,
        "database": "PostgreSQL",
        "host": os.getenv("DB_HOST", "localhost"),
        "dbname": os.getenv("DB_NAME", "contract_ai_postgres_db"),
        "port": PORT
    }

@app.get("/api/documents")
async def get_documents(request: Request):
    try:
        print("\n" + "=" * 80)
        print("📄 [PostgreSQL] GET /api/documents - Fetching all documents...")
        print(f"   Request from: {request.client.host if request.client else 'unknown'}")
        print("=" * 80)
        
        docs = db_all(
            """SELECT id, title, uploadedat AS "uploadDate",
                      status, currentversionid AS "currentVersionId", currentversionnumber AS "currentVersionNumber",
                      storageref AS "storageRef", attributecount AS "attributeCount", 
                      overallconfidence AS "overallConfidence", reviewedby AS "reviewedBy"
               FROM documents 
               ORDER BY uploadedat DESC 
               LIMIT 1000"""
        )
        
        print(f"\n✅ [PostgreSQL] Successfully retrieved {len(docs)} documents from database")
        if docs:
            print(f"   First document: {docs[0].get('id')} - {docs[0].get('title')}")
        print("=" * 80 + "\n")
        
        return [
            {**doc, "storageUrl": to_storage_url(request, doc.get("storageRef"))}
            for doc in docs
        ]
    except Exception as e:
        print(f"❌ [PostgreSQL] Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch documents")

@app.get("/api/documents/{document_id}")
async def get_document(document_id: str, request: Request):
    try:
        print("\n" + "=" * 80)
        print(f"📝 [PostgreSQL] GET /api/documents/{document_id}")
        print("=" * 80)
        
        doc = db_get(
            """SELECT id, title, uploadedat AS "uploadDate",
                      status, currentversionid AS "currentVersionId", currentversionnumber AS "currentVersionNumber",
                      storageref AS "storageRef", attributecount AS "attributeCount", 
                      overallconfidence AS "overallConfidence", reviewedby AS "reviewedBy"
               FROM documents 
               WHERE id = %s""",
            (document_id,)
        )
        
        if not doc:
            print(f"❌ [PostgreSQL] Document not found: {document_id}")
            print("=" * 80 + "\n")
            raise HTTPException(status_code=404, detail="Document not found")
        
        print(f"✅ [PostgreSQL] Document found: {doc.get('title')}")
        
        versions = db_all(
            """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber",
                      islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                      status, storageref AS "storageRef", notes
               FROM document_versions 
               WHERE documentid = %s 
               ORDER BY versionnumber DESC""",
            (document_id,)
        )
        
        print(f"   Versions loaded: {len(versions)}")
        print("=" * 80 + "\n")
        
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
            """SELECT id, documentid AS "documentId", versionnumber AS "versionNumber",
                      islatest AS "isLatest", createdat AS "createdAt", createdby AS "createdBy",
                      status, storageref AS "storageRef", notes
               FROM document_versions 
               WHERE documentid = %s 
               ORDER BY versionnumber DESC""",
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
        print("\n" + "=" * 80)
        print(f"📋 [PostgreSQL] GET /api/documents/{document_id}/attributes?version={version}")
        print(f"   includeVersion={includeVersion}")
        print("=" * 80)
        
        # Determine requested version
        version_param = version.lower()
        if version_param == "latest":
            requested_version = await get_latest_version(document_id)
            print(f"   ➡️ Resolving 'latest' version...")
        else:
            requested_version = await get_version_by_number(document_id, int(version_param))
            print(f"   ➡️ Fetching version {version_param}...")
        
        if not requested_version:
            print(f"❌ [PostgreSQL] Version not found")
            print("=" * 80 + "\n")
            raise HTTPException(status_code=404, detail="Version not found")
        
        print(f"✅ [PostgreSQL] Using version {requested_version['versionNumber']} (id: {requested_version['id']})")
        
        # Compute change metadata
        change_data = await compute_changed_in_version_number(document_id)
        changed_in = change_data["changedIn"]
        latest_version_number = change_data["latestVersionNumber"]
        
        # Fetch attributes for requested version
        rows = db_all(
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
            (document_id, requested_version["id"])
        )
        
        print(f"\n✅ [PostgreSQL] Retrieved {len(rows)} attributes from database")
        if rows:
            print(f"   Sample attributes: {[r['id'] for r in rows[:3]]}...")
        
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
        print(f"   Response format: {'with version metadata' if include_version_flag else 'attributes only'}")
        print("=" * 80 + "\n")
        
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
        print(f"❌ [PostgreSQL] Error fetching attributes: {e}")
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
async def save_review(document_id: str, payload: ReviewPayload, background_tasks: BackgroundTasks):
    conn = None
    try:
        print("\n" + "=" * 80)
        print(f"💾 [PostgreSQL] POST /api/documents/{document_id}/review")
        print(f"   Payload versionNumber: {payload.versionNumber}")
        print(f"   Payload status: {payload.status}")
        print(f"   Payload reviewedBy: {payload.reviewedBy}")
        print(f"   Number of attributes to update: {len(payload.attributes)}")
        print("=" * 80)
        
        # Determine version
        if payload.versionNumber is not None:
            version = await get_version_by_number(document_id, payload.versionNumber)
            print(f"   ➡️ Using specified version {payload.versionNumber}")
        else:
            version = await get_latest_version(document_id)
            print(f"   ➡️ Using latest version")
        
        if not version:
            print(f"❌ [PostgreSQL] Version not found")
            print("=" * 80 + "\n")
            raise HTTPException(status_code=404, detail="Version not found")
        
        print(f"\n✅ [PostgreSQL] Target version confirmed: v{version['versionNumber']} (id: {version['id']})")
        print(f"   Updating {len(payload.attributes)} attributes...")
        
        # Use transaction
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("BEGIN")
        
        # Create review session
        cursor.execute(
            """
            INSERT INTO review_sessions 
            (document_id, target_version_id, reviewer, status, created_at, updated_at)
            VALUES (%s, %s, %s, 'COMPLETED', NOW(), NOW())
            RETURNING review_id
            """,
            (document_id, version["id"], payload.reviewedBy)
        )
        review_session = cursor.fetchone()
        review_id = review_session["review_id"] if review_session else None
        
        print(f"   ✅ Created review session: {review_id}")
        
        # Update each attribute and create audit trail
        for attr in payload.attributes:
            if not attr.id:
                continue
            
            attribute_key = attr.id
            row_id = attr.rowId or f"{attribute_key}--{version['id']}"
            
            # Get existing correctedValue from extracted_fields
            cursor.execute(
                "SELECT corrected_value FROM extracted_fields WHERE row_id = %s AND version_id = %s",
                (row_id, version["id"])
            )
            existing = cursor.fetchone()
            old_corrected_value = existing["corrected_value"] if existing else None
            
            # Get original field_value for audit trail
            cursor.execute(
                "SELECT field_value FROM extracted_fields WHERE row_id = %s AND version_id = %s",
                (row_id, version["id"])
            )
            original = cursor.fetchone()
            original_value = original["field_value"] if original else None
            
            # Update correctedValue in extracted_fields
            cursor.execute(
                "UPDATE extracted_fields SET corrected_value = %s WHERE row_id = %s AND version_id = %s",
                (attr.correctedValue, row_id, version["id"])
            )
            
            # Insert into reviewed_fields for audit trail
            cursor.execute(
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
                    attribute_key,
                    original_value,
                    old_corrected_value,
                    attr.correctedValue,
                    attr.correctedValue,
                    payload.reviewedBy
                )
            )
        
        # Update document status
        cursor.execute(
            "UPDATE documents SET status = %s, reviewedby = %s, storageref = %s WHERE id = %s",
            (payload.status, payload.reviewedBy, version.get("storageRef"), document_id)
        )
        
        conn.commit()
        
        print(f"\n✅ [PostgreSQL] Review saved successfully!")
        print(f"   Review Session: {review_id}")
        print(f"   Document: {document_id}")
        print(f"   Version: {version['versionNumber']}")
        print(f"   Status: {payload.status}")
        print(f"   Reviewed by: {payload.reviewedBy}")
        print(f"   Fields updated: {len(payload.attributes)}")
        print("=" * 80 + "\n")
        
        # Build Conga payload
        conga_payload = {
            "documentId": document_id,
            "versionId": version["id"],
            "versionNumber": version["versionNumber"],
            "reviewedBy": payload.reviewedBy,
            "status": payload.status,
            "reviewSessionId": str(review_id) if review_id else None,
            "attributes": [
                {
                    "id": attr.id,
                    "rowId": attr.rowId or f"{attr.id}--{version['id']}",
                    "correctedValue": attr.correctedValue
                }
                for attr in payload.attributes if attr.id
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Get Conga client configuration
        conga_client = get_conga_client()
        
        # Queue Conga postback as background task (non-blocking)
        background_tasks.add_task(conga_client.post_review, conga_payload)
        
        return {
            "success": True,
            "documentId": document_id,
            "versionId": version["id"],
            "versionNumber": version["versionNumber"],
            "reviewSessionId": str(review_id) if review_id else None,
            "fieldsUpdated": len(payload.attributes),
            "conga": {
                "queued": True,
                "enabled": conga_client.enabled,
                "mock": conga_client.mock
            }
        }
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ [PostgreSQL] Error saving review: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to save review")
    finally:
        if conn:
            conn.close()

# =====================
# STARTUP
# =====================
@app.on_event("startup")
async def startup_event():
    print("\n" + "🚀" * 30)
    print("   FASTAPI SERVER WITH POSTGRESQL")
    print("🚀" * 30 + "\n")
    
    await ensure_schema()
    
    # Mount static files for PDFs
    if Path(CONTRACTS_DIR).exists():
        app.mount("/contracts", StaticFiles(directory=CONTRACTS_DIR), name="contracts")
        print(f"✅ Serving PDFs from: {CONTRACTS_DIR}")
    else:
        print(f"⚠️  CONTRACTS_DIR not found: {CONTRACTS_DIR}")
        print(f"   Set env var CONTRACTS_DIR to your UI's public/contracts folder so PDFs load.")
    
    print(f"\n{'=' * 60}")
    print(f"✅ API server ready on http://localhost:{PORT}")
    print(f"📚 API docs available at http://localhost:{PORT}/docs")
    print(f"{'=' * 60}\n")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
