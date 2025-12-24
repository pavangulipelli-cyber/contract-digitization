# Complete Testing & Deployment Guide

## 🚀 Quick Start (for Windows PowerShell)

### Step 1: Setup Database

```powershell
# Navigate to project directory
cd C:\Users\gulip\OneDrive\Desktop\contract-digitization-backend

# Run database setup (this will recreate everything)
psql -U postgres -f setup_database.sql
```

Expected output:
```
Database created: contract_ai_postgres_db
✅ Schema applied
✅ Data seeded
✅ Setup complete!
```

### Step 2: Start Backend Server

```powershell
# Navigate to FastAPI server directory
cd fastapi_server_postgresql

# Activate virtual environment (if you have one)
# .\venv\Scripts\Activate.ps1

# Start server
python main.py
```

Expected output:
```
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
   FASTAPI SERVER WITH POSTGRESQL
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

✅ DB ready: PostgreSQL
✅ API server ready on http://localhost:8000
```

### Step 3: Test Backend API

Open a new PowerShell window:

```powershell
# Test health endpoint
curl http://localhost:8000/health

# Get all documents
curl http://localhost:8000/api/documents

# Get specific document with versions
curl http://localhost:8000/api/documents/doc-001

# Get attributes for latest version
curl http://localhost:8000/api/documents/doc-001/attributes?version=latest
```

### Step 4: Start Frontend

Open a new PowerShell window:

```powershell
cd C:\Users\gulip\OneDrive\Desktop\contract-digitization-backend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Expected output:
```
  VITE v5.x.x ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Step 5: Test Full Flow

1. Open browser: http://localhost:5173/
2. Navigate to Documents Dashboard
3. Click on "Service Agreement – Acme Corp.pdf"
4. Verify you see:
   - ✅ 13 version tabs (v1 - v13)
   - ✅ 10 attributes
   - ✅ PDF viewer on right side
5. Edit an attribute value
6. Click "Save Review"
7. Check backend logs for:
   ```
   ✅ Created review session: <uuid>
   ✅ Review saved successfully!
   ```

## 🧪 Automated Testing

### Test 1: Schema Validation

```powershell
python test_schema.py
```

Expected output:
```
✅ PASS: All expected tables exist
✅ PASS: Found 5 documents
✅ PASS: All expected columns exist
✅ PASS: row_id correctly generated
✅ PASS: review_sessions has correct structure
✅ PASS: reviewed_fields has correct structure
✅ ALL TESTS PASSED (6/6)
🎉 Database schema is correctly set up!
```

### Test 2: API Endpoints

```powershell
# Create a test file
@"
{
  "versionNumber": 13,
  "reviewedBy": "test-user",
  "status": "Reviewed",
  "attributes": [
    {
      "id": "attr-007",
      "correctedValue": "$700,000",
      "rowId": "attr-007--doc-001-v13"
    }
  ]
}
"@ | Out-File -Encoding utf8 test_review.json

# Send review
curl -X POST http://localhost:8000/api/documents/doc-001/review `
  -H "Content-Type: application/json" `
  -d '@test_review.json'
```

Expected response:
```json
{
  "success": true,
  "documentId": "doc-001",
  "versionId": "doc-001-v13",
  "versionNumber": 13,
  "reviewSessionId": "uuid-here",
  "fieldsUpdated": 1,
  "conga": {
    "queued": true,
    "enabled": false,
    "mock": true
  }
}
```

### Test 3: Verify Audit Trail

```powershell
# Connect to database
psql -U postgres -d contract_ai_postgres_db

# Run these queries:
```

```sql
-- Check last review session
SELECT 
  review_id,
  document_id,
  reviewer,
  status,
  created_at
FROM review_sessions
ORDER BY created_at DESC
LIMIT 1;

-- Check field changes in that session
SELECT 
  attribute_key,
  original_value,
  old_corrected_value,
  new_corrected_value,
  reviewed_by
FROM reviewed_fields
WHERE review_id = (
  SELECT review_id FROM review_sessions 
  ORDER BY created_at DESC LIMIT 1
);

-- Check if extracted_fields was updated
SELECT 
  attribute_key,
  field_value,
  corrected_value
FROM extracted_fields
WHERE document_id = 'doc-001'
  AND version_id = 'doc-001-v13'
  AND attribute_key = 'attr-007';
```

Expected results:
```
review_id | document_id | reviewer   | status    | created_at
----------+-------------+------------+-----------+------------------------
uuid      | doc-001     | test-user  | COMPLETED | 2025-12-16 ...

attribute_key | original_value | old_corrected_value | new_corrected_value
--------------+----------------+---------------------+--------------------
attr-007      | $500,000       |                     | $700,000

attribute_key | field_value | corrected_value
--------------+-------------+-----------------
attr-007      | $500,000    | $700,000
```

## 📊 Database Queries for Verification

### Check all tables:
```sql
\dt
```

### Count records in each table:
```sql
SELECT 
  'documents' as table_name, COUNT(*) as count FROM documents
UNION ALL
SELECT 'document_versions', COUNT(*) FROM document_versions
UNION ALL
SELECT 'extracted_fields', COUNT(*) FROM extracted_fields
UNION ALL
SELECT 'review_sessions', COUNT(*) FROM review_sessions
UNION ALL
SELECT 'reviewed_fields', COUNT(*) FROM reviewed_fields;
```

### Check bounding boxes:
```sql
SELECT 
  document_id,
  attribute_key,
  bounding_box
FROM extracted_fields
WHERE bounding_box IS NOT NULL
LIMIT 5;
```

### View complete audit trail for a document:
```sql
SELECT 
  rs.created_at,
  rs.reviewer,
  rf.attribute_key,
  rf.original_value AS ocr_extracted,
  rf.old_corrected_value AS previous,
  rf.new_corrected_value AS updated,
  rf.approved
FROM review_sessions rs
JOIN reviewed_fields rf ON rf.review_id = rs.review_id
WHERE rs.document_id = 'doc-001'
ORDER BY rs.created_at DESC, rf.attribute_key;
```

## 🔧 Troubleshooting

### Issue: "psql: command not found"

**Solution:** Add PostgreSQL bin directory to PATH:
```powershell
$env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
```

### Issue: "relation 'extracted_fields' does not exist"

**Solution:** Re-run setup script:
```powershell
psql -U postgres -f setup_database.sql
```

### Issue: "No documents found"

**Solution:** Check if seed data was applied:
```sql
psql -U postgres -d contract_ai_postgres_db -f fastapi_server_postgresql/data/contract_ai_seed_postgres_redesigned_updated.sql
```

### Issue: FastAPI errors with "Import 'psycopg2' could not be resolved"

**Solution:** Install Python dependencies:
```powershell
cd fastapi_server_postgresql
pip install -r requirements.txt
```

### Issue: Frontend shows no documents

**Solutions:**
1. Check backend is running: `curl http://localhost:8000/health`
2. Check .env file has `VITE_API_BASE_URL=http://localhost:8000`
3. Restart frontend dev server

### Issue: "reviewSessionId" is null

**Check:**
1. Database logs for errors
2. Verify review_sessions table exists: `\d review_sessions`
3. Check server logs for "Created review session: <uuid>"

## ✅ Verification Checklist

- [ ] Database created successfully
- [ ] All 8 tables exist (documents, document_versions, extracted_fields, review_sessions, reviewed_fields, ocr_jobs, tables_extracted, conga_postback_logs)
- [ ] 5 documents seeded
- [ ] Backend server starts without errors
- [ ] GET /health returns 200
- [ ] GET /api/documents returns 5 documents
- [ ] GET /api/documents/doc-001/attributes returns 10 attributes with boundingBox field
- [ ] POST /api/documents/doc-001/review creates review session
- [ ] reviewed_fields table has audit records
- [ ] extracted_fields.corrected_value is updated
- [ ] Frontend loads documents dashboard
- [ ] Frontend can view document with 13 versions
- [ ] Frontend can save review
- [ ] Conga mock file created (logs/conga_mock_out.jsonl)

## 🎯 Success Criteria

### Backend (FastAPI)
✅ Server starts on port 8000  
✅ All API endpoints respond correctly  
✅ Database queries use new schema  
✅ Review sessions create audit trail  
✅ Bounding boxes returned in responses  

### Database (PostgreSQL)
✅ All 8 tables created  
✅ Foreign keys work correctly  
✅ row_id generated column works  
✅ Review sessions link to reviewed_fields  
✅ Audit trail captures old/new values  

### Frontend (React/Vite)
✅ Documents dashboard loads  
✅ Document detail page shows versions  
✅ Attributes display correctly  
✅ Save review works  
✅ No console errors  

---

**Last Updated:** December 16, 2025  
**Schema Version:** Redesigned (v2)  
**Status:** ✅ Ready for testing
