-- =====================================================================
-- Contract AI - PostgreSQL Schema (merged)
-- Source inputs:
--   1) pg_sql_schema.sql  (kept ALL tables)
--   2) contract_ai_seed_versioned.sql (SQLite versioning schema)
--
-- Rules applied:
-- - All tables from pg_sql_schema.sql are included.
-- - Table name collision: "documents" is overwritten to match SQLite versioning "documents" fields.
-- - All pg_sql_schema tables that reference documents now reference documents(id) (TEXT) instead of documents(document_id) (UUID).
-- - SQLite versioning tables are added: document_versions, attributes, attribute_reviews.
-- =====================================================================

-- =========================
-- EXTENSIONS
-- =========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- 0. documents  (OVERWRITTEN from SQLite versioned schema)
-- =========================
CREATE TABLE IF NOT EXISTS documents (
    id                   TEXT PRIMARY KEY,
    title                TEXT,
    uploadedAt           TIMESTAMPTZ,
    status               TEXT,
    attributeCount       INTEGER,
    overallConfidence    INTEGER,
    reviewedBy           TEXT,
    source               TEXT,
    storageRef           TEXT,
    currentVersionId     TEXT,
    currentVersionNumber INTEGER DEFAULT 1
);

-- =========================
-- 0b. document_versions (from SQLite versioning schema)
-- =========================
CREATE TABLE IF NOT EXISTS document_versions (
    id            TEXT PRIMARY KEY,
    documentId    TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    versionNumber INTEGER NOT NULL,
    isLatest      BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt     TIMESTAMPTZ,
    createdBy     TEXT,
    status        TEXT,
    storageRef    TEXT NOT NULL,
    notes         TEXT,
    UNIQUE (documentId, versionNumber)
);

-- =========================
-- 0c. attributes (from SQLite versioning schema)
-- =========================
CREATE TABLE IF NOT EXISTS attributes (
    id               TEXT PRIMARY KEY,        -- rowId (attributeKey--versionId)
    documentId        TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    name             TEXT,
    category         TEXT,
    section          TEXT,
    page             INTEGER,
    confidenceScore  INTEGER,
    confidenceLevel  TEXT,
    extractedValue   TEXT,
    correctedValue   TEXT,
    highlightedText  TEXT,
    versionId        TEXT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    attributeKey     TEXT NOT NULL,            -- stable id across versions (used by UI)
    UNIQUE (attributeKey, versionId)
);

-- =========================
-- 0d. attribute_reviews (from SQLite versioning schema)
-- =========================
CREATE TABLE IF NOT EXISTS attribute_reviews (
    id               BIGSERIAL PRIMARY KEY,
    documentId        TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    versionId         TEXT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    attributeKey      TEXT NOT NULL,
    oldCorrectedValue TEXT,
    newCorrectedValue TEXT,
    reviewedBy        TEXT,
    reviewedAt        TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- INDEXES (versioning)
-- =========================
CREATE INDEX IF NOT EXISTS idx_versions_documentId ON document_versions(documentId);
CREATE INDEX IF NOT EXISTS idx_versions_latest ON document_versions(documentId, isLatest);
CREATE INDEX IF NOT EXISTS idx_attributes_doc_ver ON attributes(documentId, versionId);
CREATE INDEX IF NOT EXISTS idx_attributes_attrKey ON attributes(attributeKey);

-- =====================================================================
-- Tables kept from pg_sql_schema.sql (with document FK updated to documents(id))
-- =====================================================================

-- =========================
-- 2. ocr_jobs
-- =========================
CREATE TABLE IF NOT EXISTS ocr_jobs (
    ocr_job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id       TEXT NOT NULL REFERENCES documents(id),
    model_used        VARCHAR(100) DEFAULT 'prebuilt-document',
    status            VARCHAR(30) DEFAULT 'running',
    started_at        TIMESTAMPTZ DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    error_message     TEXT,
    raw_response_json JSONB
);

-- =========================
-- 3. extracted_fields
-- =========================
CREATE TABLE IF NOT EXISTS extracted_fields (
    field_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocr_job_id     UUID NOT NULL REFERENCES ocr_jobs(ocr_job_id),
    document_id    TEXT NOT NULL REFERENCES documents(id),
    field_name     VARCHAR(200),
    field_type     VARCHAR(50),
    field_value    TEXT,
    confidence     NUMERIC(5,2),
    page_number    INT,
    bounding_box   JSONB,
    extracted_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 4. tables_extracted
-- =========================
CREATE TABLE IF NOT EXISTS tables_extracted (
    table_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    TEXT NOT NULL REFERENCES documents(id),
    ocr_job_id     UUID NOT NULL REFERENCES ocr_jobs(ocr_job_id),
    table_name     VARCHAR(200),
    table_json     JSONB,
    confidence     NUMERIC(5,2),
    page_number    INT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 5. review_sessions
-- =========================
CREATE TABLE IF NOT EXISTS review_sessions (
    review_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    TEXT NOT NULL REFERENCES documents(id),
    reviewer       VARCHAR(100),
    started_at     TIMESTAMPTZ DEFAULT NOW(),
    completed_at   TIMESTAMPTZ,
    status         VARCHAR(30) DEFAULT 'in_progress'
);

-- =========================
-- 6. reviewed_fields
-- =========================
CREATE TABLE IF NOT EXISTS reviewed_fields (
    field_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id            UUID REFERENCES review_sessions(review_id),
    document_id          TEXT REFERENCES documents(id),
    original_field_name  VARCHAR(200),
    original_value       TEXT,
    corrected_value      TEXT,
    reviewer_confidence  NUMERIC(5,2),
    approved             BOOLEAN DEFAULT FALSE,
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 7. conga_postback_logs
-- =========================
CREATE TABLE IF NOT EXISTS conga_postback_logs (
    postback_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id      TEXT NOT NULL REFERENCES documents(id),
    payload_json     JSONB,
    response_status  INT,
    response_body    JSONB,
    attempted_at     TIMESTAMPTZ DEFAULT NOW(),
    success          BOOLEAN DEFAULT FALSE
);

-- =========================
-- Index recommendations (kept from pg_sql_schema.sql)
-- =========================
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_docid ON ocr_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_docid ON extracted_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_docid ON review_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_reviewed_fields_reviewid ON reviewed_fields(review_id);
CREATE INDEX IF NOT EXISTS idx_postback_docid ON conga_postback_logs(document_id);

-- =====================================================================
-- END
-- =====================================================================
