# Database Schema Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CORE TABLES                              │
│                   (User-facing entities)                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  documents   │ ◄─────┐
│              │       │
│ - id         │       │ 1
│ - title      │       │
│ - status     │       │
│ - reviewedBy │       │ N
└──────────────┘       │
                       │
                 ┌─────┴──────────────┐
                 │ document_versions  │
                 │                    │
                 │ - id               │
                 │ - documentId   ────┘
                 │ - versionNumber    │
                 │ - isLatest         │
                 │ - storageRef       │
                 └────────────────────┘
                         │
                         │ 1
                         │
                         │ N
                         │
          ┌──────────────┴───────────────┐
          │                              │
          │                              │
┌─────────▼──────────┐        ┌──────────▼─────────┐
│ extracted_fields   │        │  review_sessions   │
│                    │        │                    │
│ - field_id         │        │ - review_id        │
│ - document_id  ────┤        │ - document_id  ────┤
│ - version_id   ────┤        │ - version_id   ────┤
│ - attribute_key    │        │ - reviewer         │
│ - row_id (gen)     │        │ - status           │
│ - field_name       │        │ - created_at       │
│ - field_value      │        └────────────────────┘
│ - corrected_value  │                 │
│ - bounding_box     │                 │ 1
│ - confidence_score │                 │
└────────────────────┘                 │ N
                                       │
                             ┌─────────▼──────────┐
                             │  reviewed_fields   │
                             │                    │
                             │ - reviewed_field_id│
                             │ - review_id    ────┘
                             │ - document_id      │
                             │ - version_id       │
                             │ - attribute_key    │
                             │ - original_value   │
                             │ - old_corrected    │
                             │ - new_corrected    │
                             │ - reviewed_by      │
                             └────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                     PIPELINE TABLES                             │
│                   (Future features)                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐         ┌────────────────────┐
│   ocr_jobs      │         │tables_extracted  │         │conga_postback_logs │
│                 │         │                  │         │                    │
│ - ocr_job_id    │         │ - table_id       │         │ - log_id           │
│ - document_id   │         │ - ocr_job_id     │         │ - document_id      │
│ - version_id    │         │ - document_id    │         │ - version_id       │
│ - status        │         │ - page_number    │         │ - endpoint         │
│ - started_at    │         │ - table_json     │         │ - payload          │
│ - completed_at  │         │                  │         │ - status_code      │
└─────────────────┘         └──────────────────┘         └────────────────────┘
```

## Data Flow

### 1. Document Upload & OCR Processing
```
User uploads PDF
     │
     ▼
Create document record
     │
     ▼
Create document_version (v1)
     │
     ▼
OCR processing creates ocr_jobs record
     │
     ▼
Extract fields → extracted_fields table
     │
     ▼
Extract tables → tables_extracted table
```

### 2. Review Process
```
User views document in UI
     │
     ▼
GET /api/documents/{id}/attributes?version=latest
     │
     ▼
Returns extracted_fields for that version
     │
     ▼
User corrects values in UI
     │
     ▼
POST /api/documents/{id}/review
     │
     ├─► Create review_sessions record
     │        │
     │        ▼
     │   For each field:
     │        │
     │        ├─► Get original_value from extracted_fields
     │        │
     │        ├─► Get old_corrected_value from extracted_fields
     │        │
     │        ├─► UPDATE extracted_fields.corrected_value
     │        │
     │        └─► INSERT reviewed_fields (audit trail)
     │
     └─► Queue Conga postback
              │
              ▼
         Insert conga_postback_logs
```

### 3. Version Comparison
```
User clicks different version tab
     │
     ▼
GET /api/documents/{id}/attributes?version=3
     │
     ▼
Query extracted_fields WHERE version_id = 'doc-001-v3'
     │
     ▼
Compare with other versions to compute "changedInVersionNumber"
     │
     ▼
Return attributes with change metadata
```

## Key Relationships

```
1 document → N document_versions
1 document_version → N extracted_fields
1 document_version → N review_sessions
1 review_session → N reviewed_fields

1 ocr_job → N extracted_fields
1 ocr_job → N tables_extracted
```

## Column Naming Convention

### Old Schema (camelCase):
```
documentId, versionId, attributeKey, extractedValue, correctedValue
```

### New Schema (snake_case):
```
document_id, version_id, attribute_key, field_value, corrected_value
```

### API Response (camelCase):
```json
{
  "documentId": "doc-001",
  "versionId": "doc-001-v13",
  "attributeKey": "attr-001",
  "extractedValue": "...",
  "correctedValue": "..."
}
```

## Generated Columns

### row_id (in extracted_fields)
```sql
row_id TEXT GENERATED ALWAYS AS (attribute_key || '--' || version_id) STORED
```

Example:
```
attribute_key: "attr-001"
version_id: "doc-001-v13"
→ row_id: "attr-001--doc-001-v13"
```

## Audit Trail Example

### Scenario: User updates "Liability Cap" from empty to "$700,000"

**Before:**
```
extracted_fields:
  attribute_key: "attr-007"
  field_value: "$500,000"        (OCR extracted)
  corrected_value: NULL          (not yet corrected)
```

**User Action:**
```json
POST /api/documents/doc-001/review
{
  "attributes": [{
    "id": "attr-007",
    "correctedValue": "$700,000"
  }]
}
```

**After:**

1. `review_sessions` (1 new row):
```
review_id: "uuid-123"
document_id: "doc-001"
target_version_id: "doc-001-v13"
reviewer: "john.doe@example.com"
status: "COMPLETED"
created_at: 2025-12-16 10:30:00
```

2. `reviewed_fields` (1 new row):
```
review_id: "uuid-123"
attribute_key: "attr-007"
original_value: "$500,000"        (OCR)
old_corrected_value: NULL         (previous correction)
new_corrected_value: "$700,000"   (this review)
corrected_value: "$700,000"       (final value)
approved: TRUE
reviewed_by: "john.doe@example.com"
reviewed_at: 2025-12-16 10:30:00
```

3. `extracted_fields` (updated):
```
attribute_key: "attr-007"
field_value: "$500,000"           (unchanged - OCR original)
corrected_value: "$700,000"       (updated!)
```

## Queries

### Get current state of all fields:
```sql
SELECT 
  attribute_key,
  field_name,
  field_value AS ocr_extracted,
  corrected_value AS human_corrected,
  COALESCE(corrected_value, field_value) AS effective_value
FROM extracted_fields
WHERE document_id = 'doc-001' 
  AND version_id = 'doc-001-v13';
```

### Get full audit trail for a field:
```sql
SELECT 
  rs.created_at,
  rs.reviewer,
  rf.original_value,
  rf.old_corrected_value,
  rf.new_corrected_value
FROM review_sessions rs
JOIN reviewed_fields rf ON rf.review_id = rs.review_id
WHERE rf.document_id = 'doc-001' 
  AND rf.attribute_key = 'attr-007'
ORDER BY rs.created_at DESC;
```

### Get all changes in a review session:
```sql
SELECT 
  attribute_key,
  old_corrected_value AS before,
  new_corrected_value AS after
FROM reviewed_fields
WHERE review_id = 'uuid-123'
  AND old_corrected_value IS DISTINCT FROM new_corrected_value;
```
