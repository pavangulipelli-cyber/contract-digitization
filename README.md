# Contract Digitization Backend

Express.js API server for contract digitization with document versioning support, backed by SQLite database.

## Features

- 📄 **Document Management** - Upload and manage contract documents
- 🔄 **Version Control** - Track multiple versions of each document
- 🏷️ **Attribute Extraction** - AI-extracted attributes with confidence scores
- ✏️ **Review System** - Correct and review extracted attributes
- 📊 **Export Functionality** - Export attributes to CSV or JSON
- 📁 **PDF Storage** - Static file serving for contract PDFs

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite3
- **CORS:** Enabled for cross-origin requests

## Installation

1. **Clone the repository**
   ```bash
   cd contract-digitization-backend/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   
   The database will be automatically created and seeded on first run. If you need to manually seed:
   ```bash
   cd data
   sqlite3 contract_ai_version.db < contract_ai_seed_versioned.sql
   ```

4. **Start the server**
   ```bash
   node index.js
   ```

   Server will start on `http://localhost:5000`

## Project Structure

```
contract-digitization-backend/
├── public/
│   └── contracts/
│       └── 2024/              # PDF files stored here
├── server/
│   ├── index.js               # Main server file
│   ├── package.json           # Dependencies
│   └── data/
│       ├── contract_ai_version.db              # SQLite database
│       └── contract_ai_seed_versioned.sql      # Seed data
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
# Health check
curl http://localhost:5000/health

# Get all documents
curl http://localhost:5000/api/documents

# Get document attributes
curl http://localhost:5000/api/documents/doc-001/attributes

# Export as JSON
curl http://localhost:5000/api/documents/doc-001/attributes/export?format=json

# Save review
curl -X POST http://localhost:5000/api/documents/doc-001/review \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "Jane Smith",
    "status": "Reviewed",
    "attributes": [
      {"id": "attr-012", "correctedValue": "New Value"}
    ]
  }'
```

### Using Postman

1. Import the following collection:
   - Base URL: `http://localhost:5000`
   - Set `Content-Type: application/json` for POST requests

2. Test endpoints:
   - GET requests: Simply add URL and send
   - POST `/api/documents/:id/review`: Add JSON body as shown above

### Using Browser (Chrome/Firefox)

Navigate to:
- `http://localhost:5000/health`
- `http://localhost:5000/api/documents`
- `http://localhost:5000/api/documents/doc-001`
- `http://localhost:5000/contracts/2024/techstart-nda.pdf`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `DB_FILE` | SQLite database path | `server/data/contract_ai_version.db` |
| `SEED_FILE` | SQL seed file path | `server/data/contract_ai_seed_versioned.sql` |
| `CONTRACTS_DIR` | PDF storage directory | `public/contracts` |

## Database Schema

### Tables

- **documents** - Main document records
- **document_versions** - Version history for each document
- **attributes** - Extracted attributes for each version
- **attribute_reviews** - Audit trail of attribute corrections

## Development

### Starting the server
```bash
cd server
node index.js
```

### Resetting the database
```bash
cd server/data
rm contract_ai_version.db
sqlite3 contract_ai_version.db < contract_ai_seed_versioned.sql
```

## Features in Detail

### Version Control
Each document can have multiple versions, allowing you to:
- Track changes over time
- Compare different versions
- Identify which version an attribute changed in

### Attribute Management
Attributes include:
- AI-extracted values with confidence scores
- Manually corrected values
- Metadata (category, section, page)
- Change tracking across versions

### Review Workflow
1. View extracted attributes
2. Review and correct inaccuracies
3. Submit corrections via POST request
4. System tracks who made changes and when

## License

MIT

## Support

For issues or questions, please contact the development team.
