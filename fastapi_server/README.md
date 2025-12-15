# FastAPI Backend for Contract Digitization

This is a drop-in replacement for the Express.js backend, with **zero frontend changes required**.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the server:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

   Or using Python directly:
   ```bash
   python main.py
   ```

## Environment Variables

- `PORT` - Server port (default: 8000)
- `DB_FILE` - SQLite database file path (default: `./data/contract_ai_versioned.db`)
- `SEED_FILE` - SQL seed file path (default: `./data/contract_ai_seed_versioned.sql`)
- `CONTRACTS_DIR` - Directory for serving PDF files (default: `../public/contracts`)

## Features

- ✅ Exact API compatibility with Express backend
- ✅ Same endpoints, query parameters, and JSON response shapes
- ✅ SQLite database with automatic seeding
- ✅ CORS enabled for all origins
- ✅ Static file serving for PDFs at `/contracts/**`
- ✅ Document versioning support
- ✅ Attribute change tracking across versions
- ✅ CSV and JSON export

## API Endpoints

- `GET /health` - Health check
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document with versions
- `GET /api/documents/:id/versions` - Get document versions
- `GET /api/documents/:id/attributes` - Get attributes for a version
- `GET /api/documents/:id/attributes/export` - Export attributes (CSV/JSON)
- `POST /api/documents/:id/review` - Save review corrections

## Notes

- The frontend (React + Vite) works with **FastAPI on port 8000** (Express uses 5000)
- Update frontend `VITE_API_BASE_URL` to `http://localhost:8000` to use FastAPI
- All URLs, query params, and JSON shapes match exactly
- DB schema and seed data remain unchanged
- PDFs are served from the same `/contracts/**` path
