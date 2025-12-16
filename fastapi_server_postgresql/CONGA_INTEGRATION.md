# Conga CLM (Salesforce) Integration

This backend includes integration with Conga CLM (Salesforce) to post review data after successful database commits.

## Features

- **Mock Mode**: Test integration without real Salesforce connection
- **Environment-Driven**: All settings configurable via `.env`
- **Non-Blocking**: Uses FastAPI BackgroundTasks - doesn't slow down API responses
- **Retry Logic**: Automatic retries for failed requests
- **Production-Ready**: Switch from mock to production by changing environment variables only

## Configuration

Add these settings to your `.env` file in `fastapi_server_postgresql/`:

```bash
# Conga CLM (Salesforce) Integration
CONGA_ENABLED=true              # Enable/disable Conga integration
CONGA_MOCK=true                 # true=mock mode, false=real HTTP calls
CONGA_BASE_URL=http://localhost:9999  # Conga CLM base URL
CONGA_REVIEW_PATH=/api/review   # API endpoint path
CONGA_TIMEOUT_SECONDS=10        # HTTP request timeout
CONGA_API_KEY=                  # Bearer token (leave empty for mock)
CONGA_OUTPUT_FILE=./logs/conga_mock_out.jsonl  # Mock output file
CONGA_RETRY_COUNT=2             # Number of retries on failure
```

## How It Works

### 1. Save Review Flow

```
Frontend → POST /api/documents/{id}/review
    ↓
Backend saves to PostgreSQL (transaction)
    ↓
COMMIT successful
    ↓
Queue Conga postback (BackgroundTask - non-blocking)
    ↓
Return response to frontend immediately
    ↓
Background: Post to Conga CLM
```

### 2. Mock Mode (Development)

When `CONGA_MOCK=true`:
- No real HTTP requests are made
- Payload is written to `CONGA_OUTPUT_FILE` as JSON lines
- Each line is a complete review payload with metadata
- Easy to inspect what would be sent to Conga

Example mock output (`logs/conga_mock_out.jsonl`):
```json
{"documentId":"doc-001","versionId":"ver-001-v3","versionNumber":3,"reviewedBy":"Jane Smith","status":"Reviewed","attributes":[{"id":"attr-012","rowId":"attr-012--ver-001-v3","correctedValue":"Updated Value"}],"timestamp":"2025-12-15T10:30:00.123456","mockedAt":"2025-12-15T10:30:00.123456","congaConfig":{"baseUrl":"http://localhost:9999","reviewPath":"/api/review"}}
```

### 3. Production Mode (Real Integration)

When `CONGA_MOCK=false`:
- Makes actual HTTP POST to `CONGA_BASE_URL + CONGA_REVIEW_PATH`
- Includes `Authorization: Bearer {CONGA_API_KEY}` header if key is set
- Retries on failure (configurable via `CONGA_RETRY_COUNT`)
- Logs all attempts and responses

## Payload Structure

The following payload is sent to Conga CLM:

```json
{
  "documentId": "doc-001",
  "versionId": "ver-001-v3",
  "versionNumber": 3,
  "reviewedBy": "Jane Smith",
  "status": "Reviewed",
  "attributes": [
    {
      "id": "attr-012",
      "rowId": "attr-012--ver-001-v3",
      "correctedValue": "Updated Value"
    }
  ],
  "timestamp": "2025-12-15T10:30:00.123456Z"
}
```

## API Response

The `/review` endpoint now includes Conga status in the response:

```json
{
  "success": true,
  "documentId": "doc-001",
  "versionId": "ver-001-v3",
  "versionNumber": 3,
  "conga": {
    "queued": true,
    "enabled": true,
    "mock": true
  }
}
```

**Note**: The frontend doesn't need to change - the `conga` field is optional and non-breaking.

## Switching from Mock to Production

To switch from mock mode to production:

1. **Update `.env` file:**
   ```bash
   CONGA_ENABLED=true
   CONGA_MOCK=false                                    # Change to false
   CONGA_BASE_URL=https://your-conga-instance.com     # Real Conga URL
   CONGA_API_KEY=your_bearer_token_here               # Add your API key
   ```

2. **Restart the FastAPI server:**
   ```bash
   uvicorn main:app --reload
   ```

**That's it!** No code changes required.

## Monitoring

### Mock Mode Monitoring

Check the mock output file:
```bash
cat logs/conga_mock_out.jsonl
```

Or count successful mock writes:
```bash
wc -l logs/conga_mock_out.jsonl
```

### Production Mode Monitoring

Check server logs for:
- `🔗 [Conga] Posting review to Conga CLM...` - Request initiated
- `✅ [Conga] Review posted successfully` - Request succeeded
- `⚠️  [Conga] Attempt X failed` - Retry in progress
- `❌ [Conga] All X attempts failed` - All retries exhausted

## Error Handling

- **Conga failures DO NOT block the API response** - reviews are always saved to PostgreSQL first
- **Background task failures are logged** but don't return errors to the frontend
- **Retries are automatic** based on `CONGA_RETRY_COUNT`
- **Timeouts are configurable** via `CONGA_TIMEOUT_SECONDS`

## Disabling Conga Integration

To temporarily disable Conga integration:

```bash
CONGA_ENABLED=false
```

The API will skip Conga posting and return:
```json
{
  "conga": {
    "queued": false,
    "enabled": false,
    "mock": false
  }
}
```

## Testing

### Test Mock Mode

1. Set `CONGA_ENABLED=true` and `CONGA_MOCK=true`
2. Submit a review via the frontend
3. Check `logs/conga_mock_out.jsonl` for the payload

### Test Production Mode (with Mock Server)

1. Start a mock HTTP server:
   ```bash
   python -m http.server 9999
   ```

2. Set environment:
   ```bash
   CONGA_ENABLED=true
   CONGA_MOCK=false
   CONGA_BASE_URL=http://localhost:9999
   ```

3. Submit a review and check server logs

## Dependencies

- `httpx>=0.24.0` - Async HTTP client for Conga requests
- Automatically installed via `requirements.txt`

## Architecture

```
main.py
  ↓
  uses BackgroundTasks
  ↓
  calls conga_client.py
  ↓
  CongaClient.post_review()
    ↓
    if enabled=false → skip
    ↓
    if mock=true → write to file
    ↓
    if mock=false → HTTP POST with retries
```

## Security Notes

- **Never commit `.env` file** with real `CONGA_API_KEY`
- **Mock output files** may contain sensitive data - they are gitignored
- **Use HTTPS** for production Conga URLs
- **Rotate API keys** regularly

## Support

For issues or questions about Conga integration, check:
1. Server logs for detailed error messages
2. Mock output file to verify payload structure
3. Environment variable configuration
4. Network connectivity to Conga CLM instance
