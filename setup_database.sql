-- =============================================================================
-- COMPLETE DATABASE SETUP FOR CONTRACT DIGITIZATION
-- Run this script to set up the database from scratch
-- =============================================================================

-- Drop existing database and recreate (for clean setup)
-- WARNING: This will delete all existing data!

\echo '============================================================'
\echo 'Contract AI - Database Setup Script'
\echo '============================================================'

-- Drop existing database if it exists
DROP DATABASE IF EXISTS contract_ai_postgres_db;

-- Create fresh database
CREATE DATABASE contract_ai_postgres_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

\echo '✅ Database created: contract_ai_postgres_db'

-- Connect to the new database
\c contract_ai_postgres_db

\echo '============================================================'
\echo 'Applying schema...'
\echo '============================================================'

-- Apply schema
\i fastapi_server_postgresql/data/contract_ai_schema_postgres_redesigned.sql

\echo '============================================================'
\echo 'Seeding data...'
\echo '============================================================'

-- Seed data
\i fastapi_server_postgresql/data/contract_ai_seed_postgres_redesigned_updated.sql

\echo '============================================================'
\echo 'Verifying setup...'
\echo '============================================================'

-- Verify tables
\echo 'Tables created:'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Count documents
\echo ''
\echo 'Documents seeded:'
SELECT id, title, currentversionnumber AS "current_version"
FROM documents
ORDER BY id;

-- Count extracted fields
\echo ''
\echo 'Extracted fields per document:'
SELECT 
    document_id,
    COUNT(*) as field_count,
    COUNT(DISTINCT version_id) as version_count
FROM extracted_fields
GROUP BY document_id
ORDER BY document_id;

-- Check bounding boxes
\echo ''
\echo 'Fields with bounding boxes:'
SELECT 
    COUNT(*) as total_fields,
    COUNT(bounding_box) as fields_with_bbox,
    ROUND(100.0 * COUNT(bounding_box) / COUNT(*), 2) as bbox_percentage
FROM extracted_fields;

\echo ''
\echo '============================================================'
\echo '✅ Setup complete!'
\echo '============================================================'
\echo ''
\echo 'Next steps:'
\echo '1. Start the FastAPI server: cd fastapi_server_postgresql && python main.py'
\echo '2. Test the API: curl http://localhost:8000/health'
\echo '3. Run tests: python test_schema.py'
\echo ''
