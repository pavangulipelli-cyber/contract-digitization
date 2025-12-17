# Database Schema Refactoring - Complete

## ✅ Changes Completed

### 1. **Database Schema Migration**
   - ✅ Using new schema: `contract_ai_schema_postgres_redesigned.sql`
   - ✅ Using new seed data: `contract_ai_seed_postgres_redesigned_updated.sql`

### 2. **Table Changes**

#### Old Schema → New Schema Mapping:
| Old Table | New Table | Purpose |
|-----------|-----------|---------|
| `attributes` | `extracted_fields` | Stores extracted OCR fields with versioning |
| `attribute_reviews` | `review_sessions` + `reviewed_fields` | Audit trail for reviews |
| N/A | `ocr_jobs` | Tracks OCR processing jobs |
| N/A | `tables_extracted` | Stores extracted table data |
| N/A | `conga_postback_logs` | Logs Conga integration calls |

### 3. **Column Name Changes**

#### `extracted_fields` (previously `attributes`)
| Old Column | New Column | Notes |
|------------|------------|-------|
| `attributekey` | `attribute_key` | Snake case |
| `name` | `field_name` | More descriptive |
| `page` | `page_number` | More descriptive |
| `extractedvalue` | `field_value` | Renamed for clarity |
| `correctedvalue` | `corrected_value` | Snake case |
| `confidencescore` | `confidence_score` | Snake case |
| `confidencelevel` | `confidence_level` | Snake case |
| `highlightedtext` | `highlighted_text` | Snake case |
| N/A | `bounding_box` | NEW: JSONB field for PDF coordinates |
| N/A | `row_id` | Generated column: `attribute_key || '--' || version_id` |

### 4. **API Updates (main.py)**

#### Updated Queries:
- ✅ `ensure_schema()` - Checks for new table names
- ✅ `compute_changed_in_version_number()` - Uses `extracted_fields` 
- ✅ `get_attributes()` - Returns `boundingBox` field for PDF highlighting
- ✅ `export_attributes()` - Uses new column names
- ✅ **`save_review()` - COMPLETELY REFACTORED**

#### New Review Flow with Audit Trail:

**Previous Flow:**
```python
1. Update corrected_value in attributes table
2. Insert single row into attribute_reviews
```

**New Flow (with proper audit trail):**
```python
1. Create review_session record
   - Tracks: document_id, version_id, reviewer, status, timestamps
   
2. For each attribute:
   a. Get original field_value (extracted by OCR)
   b. Get old corrected_value (previous human correction)
   c. Update corrected_value in extracted_fields
   d. Insert into reviewed_fields:
      - review_id (links to session)
      - original_value (OCR extraction)
      - old_corrected_value (before this review)
      - new_corrected_value (this review's value)
      - corrected_value (final value)
      - approved flag
      - reviewer and timestamps
      
3. Update document status
4. Return review_session_id in response
```

### 5. **Response Changes**

#### `GET /api/documents/{id}/attributes`
**NEW FIELD ADDED:**
```json
{
  "attributes": [{
    "id": "attr-001",
    "name": "Contract Start Date",
    "extractedValue": "January 1, 2024",
    "correctedValue": "",
    "boundingBox": {              // ← NEW
      "page": 1,
      "x": 0.088235,
      "y": 0.22636,
      "w": 0.163778,
      "h": 0.013889
    }
  }]
}
```

#### `POST /api/documents/{id}/review`
**NEW RESPONSE FIELDS:**
```json
{
  "success": true,
  "documentId": "doc-001",
  "versionId": "doc-001-v13",
  "versionNumber": 13,
  "reviewSessionId": "uuid-here",    // ← NEW
  "fieldsUpdated": 10,                // ← NEW
  "conga": { ... }
}
```

### 6. **Audit Trail Queries**

You can now query the full audit trail:

```sql
-- Get all reviews for a document
SELECT * FROM review_sessions 
WHERE document_id = 'doc-001'
ORDER BY created_at DESC;

-- Get field-level changes for a review session
SELECT 
  rf.attribute_key,
  rf.original_value,           -- OCR extracted
  rf.old_corrected_value,      -- Previous correction
  rf.new_corrected_value,      -- This review's correction
  rf.reviewed_by,
  rf.reviewed_at
FROM reviewed_fields rf
WHERE rf.review_id = 'review-session-uuid'
ORDER BY rf.attribute_key;

-- Get change history for a specific field
SELECT 
  rs.created_at,
  rs.reviewer,
  rf.old_corrected_value,
  rf.new_corrected_value
FROM reviewed_fields rf
JOIN review_sessions rs ON rs.review_id = rf.review_id
WHERE rf.document_id = 'doc-001' 
  AND rf.attribute_key = 'attr-003'
ORDER BY rs.created_at;
```

## 🎯 How to Deploy

### 1. **Backup Current Database** (if needed)
```bash
pg_dump -h localhost -U postgres -d contract_ai_postgres_db > backup.sql
```

### 2. **Apply New Schema**

**Option A: Fresh Start** (recommended for dev):
```sql
DROP DATABASE IF EXISTS contract_ai_postgres_db;
CREATE DATABASE contract_ai_postgres_db;
\c contract_ai_postgres_db
\i fastapi_server_postgresql/data/contract_ai_schema_postgres_redesigned.sql
\i fastapi_server_postgresql/data/contract_ai_seed_postgres_redesigned_updated.sql
```

**Option B: Run Migration** (for existing data):
The schema file includes DROP statements, so it will clean up old tables.
```bash
psql -h localhost -U postgres -d contract_ai_postgres_db \
  -f fastapi_server_postgresql/data/contract_ai_schema_postgres_redesigned.sql
psql -h localhost -U postgres -d contract_ai_postgres_db \
  -f fastapi_server_postgresql/data/contract_ai_seed_postgres_redesigned_updated.sql
```

### 3. **Restart FastAPI Server**
```bash
cd fastapi_server_postgresql
python main.py
```

The server will auto-detect the schema and seed data on startup.

### 4. **Verify Tables**
```sql
\dt
```
Should show:
- conga_postback_logs
- document_versions
- documents
- extracted_fields
- ocr_jobs
- review_sessions
- reviewed_fields
- tables_extracted

## 📊 Testing the Changes

### Test 1: Load Document with Attributes
```bash
curl http://localhost:8000/api/documents/doc-001/attributes?version=latest
```
✅ Should return attributes with `boundingBox` field

### Test 2: Save Review
```bash
curl -X POST http://localhost:8000/api/documents/doc-001/review \
  -H "Content-Type: application/json" \
  -d '{
    "versionNumber": 13,
    "reviewedBy": "test-user",
    "status": "Reviewed",
    "attributes": [
      {
        "id": "attr-001",
        "correctedValue": "Updated Value",
        "rowId": "attr-001--doc-001-v13"
      }
    ]
  }'
```
✅ Should return `reviewSessionId` and create records in both `review_sessions` and `reviewed_fields`

### Test 3: Check Audit Trail
```sql
-- Last review session
SELECT * FROM review_sessions 
WHERE document_id = 'doc-001' 
ORDER BY created_at DESC LIMIT 1;

-- Field changes in that session
SELECT * FROM reviewed_fields 
WHERE review_id = (
  SELECT review_id FROM review_sessions 
  WHERE document_id = 'doc-001' 
  ORDER BY created_at DESC LIMIT 1
);
```

## 🔄 Frontend Compatibility

**No changes required in the frontend!**

The API maintains backward compatibility:
- All existing endpoints work the same
- Response structure is the same (with new optional fields)
- Request payloads remain unchanged

The UI will automatically receive:
- `boundingBox` data for PDF highlighting (if available)
- Proper audit trail is created behind the scenes

## 🐛 Troubleshooting

### Issue: "Table does not exist"
**Solution:** Run the schema file:
```bash
psql -h localhost -U postgres -d contract_ai_postgres_db \
  -f fastapi_server_postgresql/data/contract_ai_schema_postgres_redesigned.sql
```

### Issue: "Column does not exist"
**Solution:** Your database still has old schema. Drop and recreate:
```sql
DROP DATABASE contract_ai_postgres_db;
CREATE DATABASE contract_ai_postgres_db;
-- Then run schema and seed files
```

### Issue: Review not creating audit records
**Check:**
```sql
-- Verify review_sessions table exists
\d review_sessions

-- Check for errors in logs
-- Server should print "Created review session: <uuid>"
```

## ✨ New Features Enabled

1. **PDF Bounding Box Highlighting** - Frontend can now highlight exact regions in PDFs
2. **Complete Audit Trail** - Track who changed what, when, and from what value
3. **Review Sessions** - Group all field changes in a single review operation
4. **OCR Job Tracking** - Future: Track OCR processing pipeline
5. **Table Extraction** - Future: Support for table data extraction
6. **Conga Integration Logging** - Track all API calls to Conga CLM

---

**Status:** ✅ All changes complete and tested
**Last Updated:** December 16, 2025
