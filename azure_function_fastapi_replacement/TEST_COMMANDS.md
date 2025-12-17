# Azure Functions Backend - Testing Guide

## Prerequisites
1. **Azure Functions Core Tools** installed (verify with `func --version`)
2. **Python 3.9-3.11** installed
3. **PostgreSQL** database accessible with credentials in `local.settings.json`

## Setup Steps

### 1. Navigate to the Azure Function directory
```powershell
cd c:\Users\gulip\OneDrive\Desktop\contract-digitization-backend\azure_function_fastapi_replacement
```

### 2. Create and activate virtual environment (recommended)
```powershell
python -m venv env
.\env\Scripts\Activate.ps1
```

### 3. Install dependencies
```powershell
pip install -r requirements.txt
```

## Running the Azure Function

### Start the Function App (default port 7071)
```powershell
func start
```

### Start on a specific port
```powershell
func start --port 8080
```

### Start with verbose logging
```powershell
func start --verbose
```

## Testing Endpoints

Once the function is running, test these endpoints:

### 1. Health Check
```powershell
# Test health endpoint
curl http://localhost:7071/api/health

# Or with Invoke-WebRequest
Invoke-WebRequest -Uri "http://localhost:7071/api/health" -Method GET | Select-Object -ExpandProperty Content
```

### 2. Get All Documents
```powershell
curl http://localhost:7071/api/api/documents

# Or
Invoke-WebRequest -Uri "http://localhost:7071/api/api/documents" -Method GET | Select-Object -ExpandProperty Content
```

### 3. Get Single Document
```powershell
# Replace {document_id} with actual ID from your database
curl http://localhost:7071/api/api/documents/{document_id}

# Example with ID = 1
Invoke-WebRequest -Uri "http://localhost:7071/api/api/documents/1" -Method GET | Select-Object -ExpandProperty Content
```

### 4. Get Document Versions
```powershell
curl http://localhost:7071/api/api/documents/{document_id}/versions

# Example
Invoke-WebRequest -Uri "http://localhost:7071/api/api/documents/1/versions" -Method GET | Select-Object -ExpandProperty Content
```

### 5. Get Document Attributes
```powershell
# Latest version
curl "http://localhost:7071/api/api/documents/{document_id}/attributes?version=latest"

# Specific version
curl "http://localhost:7071/api/api/documents/{document_id}/attributes?version=1"

# Example
Invoke-WebRequest -Uri "http://localhost:7071/api/api/documents/1/attributes?version=latest" -Method GET | Select-Object -ExpandProperty Content
```

### 6. Export Attributes
```powershell
# Export as JSON
curl "http://localhost:7071/api/api/documents/{document_id}/attributes/export?format=json&version=latest"

# Export as CSV
curl "http://localhost:7071/api/api/documents/{document_id}/attributes/export?format=csv&version=latest" -o attributes.csv

# Example
Invoke-WebRequest -Uri "http://localhost:7071/api/api/documents/1/attributes/export?format=json" -Method GET | Select-Object -ExpandProperty Content
```

### 7. Submit Review (POST)
```powershell
# Using curl
curl -X POST http://localhost:7071/api/api/documents/{document_id}/review `
  -H "Content-Type: application/json" `
  -d '{\"corrections\": {\"contractValue\": \"100000\"}, \"reviewerName\": \"John Doe\", \"notes\": \"Reviewed and approved\"}'

# Using Invoke-WebRequest
$body = @{
    corrections = @{
        "contractValue" = "100000"
        "startDate" = "2024-01-01"
    }
    reviewerName = "John Doe"
    notes = "Reviewed and corrected values"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:7071/api/api/documents/1/review" -Method POST -Body $body -ContentType "application/json" | Select-Object -ExpandProperty Content
```

## Database Connection Test

### Test PostgreSQL connection separately
```powershell
# Create a simple test script
@"
import psycopg2
import os

# Use values from local.settings.json
conn = psycopg2.connect(
    host='psql-napd-pricing-contractiq.postgres.database.azure.com',
    port=5432,
    dbname='contract_ai_postgres_db',
    user='psqladmin',
    password='AbpCfnuL?9TCnZxW?_v7f7eW1RoKY'
)
print('✓ Database connection successful!')
cur = conn.cursor()
cur.execute('SELECT COUNT(*) FROM documents')
count = cur.fetchone()[0]
print(f'✓ Found {count} documents in database')
conn.close()
"@ | Out-File -FilePath test_db.py -Encoding UTF8

python test_db.py
```

## Troubleshooting

### Issue: Function won't start
- Check Python version: `python --version` (should be 3.9-3.11)
- Verify Azure Functions Core Tools: `func --version` (should be 4.x)
- Check if port is already in use: `Get-NetTCPConnection -LocalPort 7071`

### Issue: Database connection errors
- Verify PostgreSQL server is running and accessible
- Check credentials in `local.settings.json`
- Test firewall rules (Azure PostgreSQL requires whitelist)
- For Azure PostgreSQL, ensure your IP is whitelisted

### Issue: Import errors
- Reinstall requirements: `pip install -r requirements.txt --force-reinstall`
- Check virtual environment is activated

### Issue: CORS errors from frontend
- Update `CORS_ALLOW_ORIGIN` in `local.settings.json` to match your frontend URL
- For development, you can use `"*"` to allow all origins

## Performance Testing

### Load test with multiple requests
```powershell
# Simple loop to test 10 requests
1..10 | ForEach-Object {
    $response = Invoke-WebRequest -Uri "http://localhost:7071/api/health" -Method GET
    Write-Host "Request $_ : Status $($response.StatusCode)"
}
```

## Logs Location

Azure Functions logs appear in the terminal where you ran `func start`. For more detailed logs:
- Check the console output
- Logs are also visible in Azure Portal (when deployed)

## Next Steps

1. **Deploy to Azure**: Use `func azure functionapp publish <app-name>`
2. **Connect Frontend**: Update frontend `VITE_API_BASE_URL` to point to this function
3. **Monitor**: Use Application Insights for production monitoring
