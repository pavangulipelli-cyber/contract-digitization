# FastAPI Backend with PostgreSQL

FastAPI backend for contract digitization using PostgreSQL database with **zero frontend changes required**.

## Prerequisites

1. **PostgreSQL installed and running**
   - Windows: https://www.postgresql.org/download/windows/
   - Linux: `sudo apt-get install postgresql`
   - Mac: `brew install postgresql`
   - Default port: 5432

2. **Create PostgreSQL database**
   ```bash
   # Login to PostgreSQL
   psql -U postgres
   
   # Create database
   CREATE DATABASE contract_ai_postgres_db;
   
   # Exit
   \q
   ```

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables**
   
   Update the `.env` file in this directory with your PostgreSQL credentials:
   
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=contract_ai_postgres_db
   DB_USER=postgres
   DB_PASSWORD=your_actual_password_here  # ⚠️ CHANGE THIS
   
   PORT=8000
   CONTRACTS_DIR=../public/contracts
   PG_SCHEMA_FILE=./data/contract_ai_schema_postgres.sql
   ```
   
   **IMPORTANT:** Replace `password` with your actual PostgreSQL password.

3. **Run the server:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

   Or using Python directly:
   ```bash
   python main.py
   ```

4. **Database Schema Auto-Creation**
   
   The server automatically creates required tables on first startup by executing `data/contract_ai_schema_postgres.sql`.
   
   Expected output:
   ```
   ⚠️  Missing tables: attributes, document_versions, documents
   📦 Creating schema from: ./data/contract_ai_schema_postgres.sql
   ✅ Schema created successfully
   ✅ DB ready: PostgreSQL (schemaApplied=True)
   ✅ API server ready on http://localhost:8000
   ```

## Features

- ✅ **PostgreSQL database** with auto-schema creation
- ✅ Exact API compatibility with SQLite/Express backends
- ✅ Same endpoints, query parameters, and JSON response shapes
- ✅ CORS enabled for all origins
- ✅ Static file serving for PDFs at `/contracts/**`
- ✅ Document versioning support
- ✅ Attribute change tracking across versions
- ✅ CSV and JSON export
- ✅ Transaction support for data integrity

## API Endpoints

All endpoints identical to SQLite/Express backends:

- `GET /health` - Health check
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document with versions
- `GET /api/documents/:id/versions` - Get document versions
- `GET /api/documents/:id/attributes?version=latest&includeVersion=1` - Get attributes
- `GET /api/documents/:id/attributes/export?format=csv&version=latest` - Export
- `POST /api/documents/:id/review` - Save review corrections

## Interactive API Docs

Visit http://localhost:8000/docs for Swagger UI.

## Frontend Integration

No changes required. Ensure in project root `.env`:
```env
VITE_API_BASE_URL=http://localhost:8000
```

## Troubleshooting

**Connection errors?**
1. Check PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
2. Verify credentials in `.env`
3. Confirm database exists: `psql -U postgres -l | grep contract_ai_postgres_db`

**Schema issues?**
Manually recreate:
```bash
psql -U postgres -d contract_ai_postgres_db -f data/contract_ai_schema_postgres.sql
```

**Port conflicts?**
Change `PORT` in `.env` and restart.

## Security

- Never commit `.env` with real passwords
- Add `.env` to `.gitignore`
- Use environment variables or secrets management in production

## Migration from SQLite

See [../PostgreSQL_Migration_Guide.txt](../PostgreSQL_Migration_Guide.txt) for data export/import instructions.

- The frontend (React + Vite) works with **FastAPI on port 8000** (Express uses 5000)
- Update frontend `VITE_API_BASE_URL` to `http://localhost:8000` to use FastAPI
- All URLs, query params, and JSON shapes match exactly
- DB schema and seed data remain unchanged
- PDFs are served from the same `/contracts/**` path
