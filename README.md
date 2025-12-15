# Contract Digitization Backend

FastAPI server for contract digitization with document versioning support, backed by PostgreSQL database.

## Features

- 📄 **Document Management** - Upload and manage contract documents
- 🔄 **Version Control** - Track multiple versions of each document
- 🏷️ **Attribute Extraction** - AI-extracted attributes with confidence scores
- ✏️ **Review System** - Correct and review extracted attributes
- 📊 **Export Functionality** - Export attributes to CSV or JSON
- 📁 **PDF Storage** - Static file serving for contract PDFs
- 🤖 **Auto-Seeding** - Database automatically created and seeded on startup

## Tech Stack

- **Runtime:** Python 3.8+
- **Framework:** FastAPI 0.116.1+
- **Database:** PostgreSQL
- **Port:** 8000 (default)
- **Features:** Async support, auto-documentation (Swagger UI at `/docs`), CORS enabled

## Installation

### Prerequisites

- Python 3.8 or higher
- PostgreSQL server running (localhost:5432 or custom host)
- PostgreSQL database created (e.g., `contract_ai_postgres_db`)

### Setup Steps

1. **Navigate to FastAPI PostgreSQL directory**
   ```bash
   cd fastapi_server_postgresql
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```
   
   Requirements:
   - fastapi>=0.116.1
   - uvicorn[standard]>=0.35.0
   - pydantic>=2.11.0,<3.0.0
   - psycopg2-binary==2.9.9
   - python-dotenv==1.0.0
   - python-multipart

3. **Configure PostgreSQL Connection**
   
   Create a `.env` file in the `fastapi_server_postgresql` directory:
   
   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=contract_ai_postgres_db
   DB_USER=postgres
   DB_PASSWORD=your_password_here
   PG_SCHEMA_FILE=data/contract_ai_schema_postgres.sql
   PG_SEED_FILE=data/contract_ai_seed_postgres.sql
   ```

4. **Run the server**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   
   Or using Python directly:
   ```bash
   python main.py
   ```

5. **Database Setup** ✨ Automatic!
   - Schema is **automatically created** on first startup if tables don't exist
   - Database is **automatically seeded** with demo data (5 documents, 15 versions, 105 attributes) if empty
   - No manual SQL scripts required!
   - Comprehensive logging shows all database operations

6. **Access the API**
   - API: `http://localhost:8000`
   - Interactive Docs: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/health`

7. **Configure Frontend** (Optional)
   
   Create a `.env` file in the project root to connect the React frontend to the FastAPI backend:
   
   ```bash
   # In project root directory
   echo VITE_API_BASE_URL=http://localhost:8000 > .env
   ```
   
   Or manually create `.env` with:
   ```
   VITE_API_BASE_URL=http://localhost:8000
   ```

## Project Structure

```
contract-digitization-backend/
├── public/
│   └── contracts/
│       └── 2024/                              # PDF files stored here
├── fastapi_server_postgresql/                 # PostgreSQL Backend
│   ├── main.py                                # FastAPI server with auto-schema
│   ├── db_pg.py                               # PostgreSQL connection helpers
│   ├── requirements.txt                       # Python dependencies
│   ├── .env                                   # Database credentials (not in git)
│   ├── .gitignore                             # Protects .env file
│   └── data/
│       ├── contract_ai_schema_postgres.sql    # Database schema
│       └── contract_ai_seed_postgres.sql      # Demo seed data
└── README.md
```

## API Endpoints

**Endpoint Summary (quick bullets)**
- GET `/health`
- GET `/api/documents`
- GET `/api/documents/:id`
- GET `/api/documents/:id/versions`
- GET `/api/documents/:id/attributes?version=latest|<number>`
- GET `/api/documents/:id/attributes/export?format=csv|json&version=latest|<number>`
- POST `/api/documents/:id/review`
- GET `/contracts/**/*.pdf`

### Health Check
- **GET** `/health`
  - Check if server is running
  - Response: `{ "ok": true }`

### Documents

- **GET** `/api/documents`
  - Get list of all documents
  - Returns array of documents with metadata

- **GET** `/api/documents/:id`
  - Get specific document details with all versions
  - Example: `/api/documents/doc-001`

- **GET** `/api/documents/:id/versions`
  - Get all versions for a specific document
  - Returns array of versions ordered by version number

### Attributes

- **GET** `/api/documents/:id/attributes`
  - Get attributes for a document version
  - Query Parameters:
    - `version` - Version number or "latest" (default: "latest")
  - Example: `/api/documents/doc-001/attributes?version=2`

- **GET** `/api/documents/:id/attributes/export`
  - Export attributes to CSV or JSON
  - Query Parameters:
    - `format` - "csv" or "json" (default: "csv")
    - `version` - Version number or "latest" (default: "latest")
  - Example: `/api/documents/doc-001/attributes/export?format=json&version=latest`

### Review

- **POST** `/api/documents/:id/review`
  - Save review and update corrected values
  - Request Body:
    ```json
    {
      "reviewedBy": "John Doe",
      "status": "Reviewed",
      "versionNumber": 3,
      "attributes": [
        {
          "id": "attr-012",
          "correctedValue": "Updated Value"
        }
      ]
    }
    ```

### Static Files

- **GET** `/contracts/**/*.pdf`
  - Access contract PDF files
  - Example: `/contracts/2024/techstart-nda.pdf`

## Usage Examples

### Using cURL

```bash
# Health check (FastAPI)
curl http://localhost:8000/health

# Get all documents
curl http://localhost:8000/api/documents

# Get document attributes
curl http://localhost:8000/api/documents/doc-001/attributes

# Export as JSON
curl http://localhost:8000/api/documents/doc-001/attributes/export?format=json

# Save review
curl -X POST http://localhost:8000/api/documents/doc-001/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "Jane Smith",
    "status": "Reviewed",
    "attributes": [
      {"id": "attr-012", "correctedValue": "New Value"}
    ]
  }'
```

### Using Browser (Chrome/Firefox)

Navigate to:
- **Interactive API Docs:** `http://localhost:8000/docs`
- **Health Check:** `http://localhost:8000/health`
- **Documents:** `http://localhost:8000/api/documents`
- **Document Details:** `http://localhost:8000/api/documents/doc-001`
- **PDF File:** `http://localhost:8000/contracts/2024/techstart-nda.pdf`
### PostgreSQL Backend

Create a `.env` file in `fastapi_server_postgresql/`:

```bash
DB_HOST=localhost              # PostgreSQL host
DB_PORT=5432                   # PostgreSQL port
DB_NAME=contract_ai_postgres_db # Database name
DB_USER=postgres               # Database user
DB_PASSWORD=your_password      # Database password
PG_SCHEMA_FILE=data/contract_ai_schema_postgres.sql
PG_SEED_FILE=data/contract_ai_seed_postgres.sql
```PostgreSQL Tables

- **documents** - Main document records with metadata
- **document_versions** - Version history for each document
- **attributes** - Extracted attributes for each version
- **attribute_reviews** - Audit trail of attribute corrections

### Key Features

- **Lowercase Column Names**: PostgreSQL stores unquoted identifiers as lowercase
- **RealDictCursor**: Returns query results as dictionaries for easy JSON serialization
- **Transactions*_postgresql
uvicorn main:app --reload --port 8000
```

### View interactive API documentation
```bash
# Open browser to http://localhost:8000/docs
```

### Resetting the database
```bash
# Connect to PostgreSQL and drop/recreate tables
psql -U postgres -d contract_ai_postgres_db

# In psql:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q

# Restart FastAPI server - schema and seed data will be auto-created
```

### Viewing server logs
The PostgreSQL backend includes comprehensive logging:
- Request tracking with client IP
- Query execution details
- Result counts and sample data
- Transaction status (BEGIN/COMMIT/ROLLBACK)
- Banner-formatted output for easy debugging*documents** - Main document records
- **document_versions** - Version history for each document
- **attributes** - Extracted attributes for each version
- **attribute_reviews** - Audit trail of attribute corrections

## Development

### Starting the server
```bash
cd fastapi_server
uvicorn main:app --reload --port 8000
```

### View interactive API documentation
```bash
# Open browser to http://localhost:8000/docs
```

### Resetting the database
```bash
cd fastapi_server/data
rm contract_ai_versioned.db
# DatabasePostgreSQL schema on startup if tables don't exist
- Checks if database is empty (document count = 0)
- Seeds demo data if database is empty:
  - 5 sample documents (doc-001 to doc-005)
  - 15 document versions (3 per document)
  - 105 attributes across all versions
- Resets sequences to prevent duplicate key errors
- Logs detailed seeding status with banners and emojis

### Comprehensive Logging 📊
Every API endpoint includes:
- Banner-formatted console output (=== separators)
- Request tracking with client IP
- Operation details (document IDs, version numbers, counts)
- Sample data previews
- Success confirmations with emoji indicators (📄, 📝, 📋, 💾, ✅)
- Error details for troubleshooting

Example log output:
```
================================================================================
📄 [PostgreSQL] GET /api/documents - Fetching all documents...
   Request from: 127.0.0.1
================================================================================
✅ [PostgreSQL] Successfully retrieved 5 documents
================================================================================
``

To use FastAPI server with the React frontend:

1. **Update environment variable:**
   ```bash
   # In .env file
   VITE_API_BASE_URL=http://localhost:8000
   ```

2. **Restart Vite dev server:**
   ```bash
   npm run dev
   ```

## Features in Detail

### Auto-Seeding ✨
The FastAPI server automatically:
- Creates the SQLite database file on startup
- Checks for required tables (`documents`, `document_versions`, `attributes`)
- Seeds the database if tables are missing
- Logs the seeding status: `✅ DB ready: <path> (seeded=true/false)`

### Version Control
Each document can have multiple versions, allowing you to:
- Track changes over time
- Compare different versions
- Identify which version an attribute changed in
- Poll for new versions automatically (frontend feature)

### Attribute Management
Attributes include:
- AI-extracted values with confidence scores
- Manually corrected values
- Metadata (category, section, page)
- Change tracking across versions
- Highlighted text from source document

### Review Workflow
1. View extracted attributes
2. Review and correct inaccuracies
3. Submit corrections via POST request
4. System tracks who made changes and when
5. Corrections always save to the latest version

## License

MIT

## Support

For issues or questions, please contact the development team.
