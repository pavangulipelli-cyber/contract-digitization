-- =============================================================================
-- Contract AI (PostgreSQL) - Redesigned Schema (versioning + OCR + reviews)
-- =============================================================================
-- Goals:
--   1) Keep versioning tables used by the UI: documents, document_versions
--   2) Remove redundant tables: attributes, attribute_reviews
--   3) Use extracted_fields as the single “versioned attributes” table (with bounding_box)
--   4) Use reviewed_fields as the audit/history of corrections (and/or review outputs)
-- =============================================================================

BEGIN;

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Drop legacy / duplicate tables (safe to run multiple times)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS attribute_reviews CASCADE;
DROP TABLE IF EXISTS attributes CASCADE;

-- Drop new tables first (if re-running from scratch)
DROP TABLE IF EXISTS conga_postback_logs CASCADE;
DROP TABLE IF EXISTS reviewed_fields CASCADE;
DROP TABLE IF EXISTS review_sessions CASCADE;
DROP TABLE IF EXISTS tables_extracted CASCADE;
DROP TABLE IF EXISTS extracted_fields CASCADE;
DROP TABLE IF EXISTS ocr_jobs CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

-- ---------------------------------------------------------------------------
-- Versioning tables (UI)
-- NOTE: Identifiers are unquoted. Postgres stores them as lowercase:
--       uploadedAt -> uploadedat, documentId -> documentid, etc.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  document_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Unique document ID
  file_name           VARCHAR(255) NOT NULL, 
  blob_url             TEXT NOT NULL,                      -- Original PDF file name
  file_hash           TEXT,                                        -- SHA256 or MD5 for deduplication
  source_system       VARCHAR(50) DEFAULT 'CONGA',                 -- e.g. CONGA, SFTP, Manual upload
  uploaded_at          TIMESTAMPTZ,
  status               TEXT,
  last_processed_at   TIMESTAMP,                                   -- Last OCR extraction time
  attributeCount       INTEGER,
  overallConfidence    INTEGER,
  reviewedBy           TEXT,
  title                TEXT,
  current_version_id     TEXT,
  current_version_number INTEGER
);

CREATE TABLE IF NOT EXISTS document_versions (
  id             TEXT PRIMARY KEY,
  documentId     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  versionNumber  INTEGER NOT NULL,
  isLatest       BOOLEAN DEFAULT FALSE,
  createdAt      TIMESTAMPTZ DEFAULT NOW(),
  createdBy      TEXT,
  status         TEXT,
  blob_url       TEXT NOT NULL,
  notes          TEXT,
  UNIQUE (documentId, versionNumber)
);

-- ---------------------------------------------------------------------------
-- OCR jobs (pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ocr_jobs (
  ocr_job_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id     TEXT REFERENCES document_versions(id) ON DELETE SET NULL,
  model_used          VARCHAR(100) DEFAULT 'prebuilt-document',     -- Model type used for OCR
  status         VARCHAR(30) DEFAULT 'running',
  started_at     TIMESTAMP DEFAULT NOW(),
  completed_at   TIMESTAMP,
  error_message       TEXT,                                         -- Error details if failed
  raw_response_json   JSONB                                         -- Full JSON from DI
);


-- ---------------------------------------------------------------------------
-- extracted_fields = the single source of truth for “attributes”
-- (merged from old attributes table + pg_sql_schema extracted_fields)
-- bounding_box format (JSONB):
--   {"page": 1, "x": 0.12, "y": 0.34, "w": 0.25, "h": 0.05}
-- normalized coords (0..1), top-left origin
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extracted_fields (
  field_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_job_id        UUID REFERENCES ocr_jobs(ocr_job_id) ON DELETE SET NULL,

  document_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id        TEXT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,

  -- Stable key across versions (used by UI)
  attribute_key     TEXT NOT NULL,

  -- UI rowId compatibility (attrKey--versionId)
  row_id            TEXT GENERATED ALWAYS AS (attribute_key || '--' || version_id) STORED,
  field_type          VARCHAR(50),                                 -- date | string | number | table | clause
  -- UI metadata
  field_name        VARCHAR(200),        -- old attributes.name
  category          TEXT,                -- old attributes.category
  section           TEXT,                -- old attributes.section
  page_number       INT,                 -- old attributes.page

  -- values
  field_value       TEXT,                -- old attributes.extractedValue
  corrected_value   TEXT,                -- old attributes.correctedValue

  confidence_score  INTEGER,             -- old attributes.confidenceScore (0..100)
  confidence_level  TEXT,                -- low/medium/high
  confidence        NUMERIC(5,2),         -- optional (can mirror confidence_score)

  highlighted_text  TEXT,                -- old attributes.highlightedText
  bounding_box      JSONB,               -- highlight rectangle for PDF

  extracted_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (attribute_key, version_id),
  UNIQUE (row_id)
);

CREATE INDEX IF NOT EXISTS idx_extracted_fields_doc_ver
  ON extracted_fields (document_id, version_id);

CREATE INDEX IF NOT EXISTS idx_extracted_fields_key
  ON extracted_fields (document_id, attribute_key);

-- If you plan to query JSON fields, consider a GIN index:
-- CREATE INDEX IF NOT EXISTS idx_extracted_fields_bbox_gin ON extracted_fields USING GIN (bounding_box);

-- ---------------------------------------------------------------------------
-- tables_extracted (pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tables_extracted (
  table_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_job_id      UUID NOT NULL REFERENCES ocr_jobs(ocr_job_id) ON DELETE CASCADE,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id      TEXT REFERENCES document_versions(id) ON DELETE SET NULL,
  page_number     INT,
  table_json      JSONB,
  extracted_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Reviews (sessions + per-field outputs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_sessions (
  review_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_version_id TEXT REFERENCES document_versions(id) ON DELETE SET NULL,
  reviewer         TEXT,
  status           TEXT DEFAULT 'IN_PROGRESS',
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviewed_fields (
  reviewed_field_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id          UUID REFERENCES review_sessions(review_id) ON DELETE CASCADE,

  document_id        TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_version_id  TEXT REFERENCES document_versions(id) ON DELETE SET NULL,
  attribute_key      TEXT,

  -- values / audit
  original_value     TEXT,
  corrected_value    TEXT,
  old_corrected_value TEXT,
  new_corrected_value TEXT,

  approved           BOOLEAN DEFAULT FALSE,
  reviewed_by        TEXT,
  reviewed_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Conga / Salesforce postback logging
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conga_postback_logs (
  log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   TEXT REFERENCES documents(id) ON DELETE SET NULL,
  version_id    TEXT REFERENCES document_versions(id) ON DELETE SET NULL,
  endpoint      TEXT,
  payload       JSONB,
  status_code   INT,
  response_body TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
