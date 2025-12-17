# Conga Integration Database Logging Implementation

## Date: December 17, 2025

## Overview
Enhanced Conga CLM integration to log all postback attempts (success and failure) to the PostgreSQL `conga_postback_logs` table for audit trail and debugging.

## Changes Made

### 1. Updated `conga_client.py`

#### Method Signature Change
**Before:**
```python
async def post_review(self, payload: Dict[str, Any]) -> Dict[str, Any]:
```

**After:**
```python
async def send_review_async(
    self,
    document_id: str,
    version_id: str,
    corrections: Dict[str, str],
    reviewer: str
) -> Dict[str, Any]:
```

**Rationale:**
- Matches the method name called in `function_app.py`
- Explicit parameters instead of generic payload
- Builds payload internally for consistency

#### Enhanced Return Data
All return paths now include database logging fields:
- `endpoint`: Full URL where request was sent
- `payload`: Complete request payload (JSON serializable)
- `status_code`: HTTP status code (None if not applicable)
- `response_body`: Response text or error message (JSON string)

**Disabled Mode:**
```python
return {
    "skipped": True,
    "reason": "CONGA_ENABLED=false",
    "endpoint": None,
    "payload": payload,
    "status_code": None,
    "response_body": None
}
```

**Mock Mode (Success):**
```python
return {
    "mocked": True,
    "success": True,
    "endpoint": f"{self.base_url}{self.review_path}",
    "payload": payload,
    "status_code": 200,
    "response_body": json.dumps({"mocked": True, "success": True})
}
```

**Mock Mode (Error):**
```python
return {
    "mocked": True,
    "success": False,
    "error": str(e),
    "endpoint": f"{self.base_url}{self.review_path}",
    "payload": payload,
    "status_code": None,
    "response_body": json.dumps({"error": str(e)})
}
```

**Real Mode (Success):**
```python
response_body = response.text if response.text else "{}"

return {
    "success": True,
    "statusCode": response.status_code,
    "endpoint": url,
    "payload": payload,
    "status_code": response.status_code,
    "response_body": response_body
}
```

**Real Mode (Failed after retries):**
```python
return {
    "success": False,
    "error": last_error,
    "endpoint": url,
    "payload": payload,
    "status_code": None,
    "response_body": json.dumps({"error": last_error})
}
```

### 2. Updated `function_app.py`

#### Added Database Logging Function

```python
def _log_conga_postback(document_id: str, version_id: str, result: Dict[str, Any]) -> None:
    """Log Conga postback attempt to database."""
    try:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO conga_postback_logs 
                       (document_id, version_id, endpoint, payload, status_code, response_body)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (
                        document_id,
                        version_id,
                        result.get("endpoint"),
                        json.dumps(result.get("payload", {})),
                        result.get("status_code"),
                        result.get("response_body")
                    )
                )
            conn.commit()
            logging.info(f"Logged Conga postback for {document_id} (status: {result.get('status_code')})")
        except Exception as e:
            conn.rollback()
            logging.error(f"Failed to log Conga postback: {e}")
        finally:
            conn.close()
    except Exception as e:
        logging.error(f"Database connection error when logging Conga postback: {e}")
```

**Features:**
- Inserts into `conga_postback_logs` table
- Handles connection errors gracefully
- Logs success/failure to application logs
- Does not throw exceptions (logging should never break the main flow)

#### Enhanced save_review Endpoint

**Async Mode (Fire and Forget):**
```python
if CONGA_CALL_MODE == "async":
    async def send_and_log():
        try:
            result = await conga_client.send_review_async(
                document_id, latest_version_id, corrections_by_key, reviewer_name
            )
            _log_conga_postback(document_id, latest_version_id, result)
        except Exception as e:
            logging.error(f"Async Conga send failed: {e}")
            _log_conga_postback(document_id, latest_version_id, {
                "success": False,
                "error": str(e),
                "endpoint": None,
                "payload": {"documentId": document_id, "versionId": latest_version_id},
                "status_code": None,
                "response_body": str(e)
            })
    
    asyncio.create_task(send_and_log())
```

**Sync Mode (Wait for Result):**
```python
else:
    conga_result = await conga_client.send_review_async(
        document_id, latest_version_id, corrections_by_key, reviewer_name
    )
    _log_conga_postback(document_id, latest_version_id, conga_result)
```

**Error Handling:**
```python
except Exception as conga_err:
    logging.warning(f"Conga integration error: {conga_err}")
    _log_conga_postback(document_id, latest_version_id, {
        "success": False,
        "error": str(conga_err),
        "endpoint": None,
        "payload": {"documentId": document_id, "versionId": latest_version_id},
        "status_code": None,
        "response_body": str(conga_err)
    })
```

**Response Enhancement:**
```python
return _json_response({
    "ok": True,
    "versionNumber": latest_version_num,
    "versionId": latest_version_id,
    "updatedCount": update_count,
    "updatedKeys": updated_keys,
    "congaResult": conga_result if conga_result else None,  # NEW
})
```

## Database Schema Integration

### Table: `conga_postback_logs`

```sql
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
```

### Sample Log Entry

**Successful Mock Request:**
```sql
INSERT INTO conga_postback_logs VALUES (
  gen_random_uuid(),
  'doc-001',
  'ver-doc-001-v3',
  'http://localhost:9999/api/review',
  '{"documentId": "doc-001", "versionId": "ver-doc-001-v3", "corrections": {...}, "reviewer": "John Doe"}',
  200,
  '{"mocked": true, "success": true}',
  NOW()
);
```

**Failed Real Request:**
```sql
INSERT INTO conga_postback_logs VALUES (
  gen_random_uuid(),
  'doc-001',
  'ver-doc-001-v3',
  'https://conga-api.example.com/api/review',
  '{"documentId": "doc-001", "versionId": "ver-doc-001-v3", "corrections": {...}, "reviewer": "John Doe"}',
  NULL,
  '{"error": "Connection timeout after 3 retries"}',
  NOW()
);
```

## Configuration

### Environment Variables

**Conga Client:**
- `CONGA_ENABLED` - Enable/disable Conga integration (default: `false`)
- `CONGA_MOCK` - Use mock mode (file logging) (default: `true`)
- `CONGA_BASE_URL` - Conga API base URL (default: `http://localhost:9999`)
- `CONGA_REVIEW_PATH` - Review endpoint path (default: `/api/review`)
- `CONGA_TIMEOUT_SECONDS` - Request timeout (default: `10`)
- `CONGA_API_KEY` - Authorization token (optional)
- `CONGA_OUTPUT_FILE` - Mock output file path (default: `./logs/conga_mock_out.jsonl`)
- `CONGA_RETRY_COUNT` - Number of retries (default: `2`)

**Function App:**
- `CONGA_CALL_MODE` - `async` (fire-and-forget) or `sync` (wait for result) (default: `async`)

### Typical Configurations

**Development (Mock Mode):**
```env
CONGA_ENABLED=true
CONGA_MOCK=true
CONGA_CALL_MODE=async
CONGA_OUTPUT_FILE=./logs/conga_mock_out.jsonl
```

**Staging (Real API, Async):**
```env
CONGA_ENABLED=true
CONGA_MOCK=false
CONGA_BASE_URL=https://staging-conga-api.example.com
CONGA_API_KEY=your-staging-api-key
CONGA_CALL_MODE=async
CONGA_RETRY_COUNT=3
```

**Production (Real API, Sync):**
```env
CONGA_ENABLED=true
CONGA_MOCK=false
CONGA_BASE_URL=https://conga-api.example.com
CONGA_API_KEY=your-production-api-key
CONGA_CALL_MODE=sync
CONGA_RETRY_COUNT=3
CONGA_TIMEOUT_SECONDS=15
```

## Logging & Monitoring

### Application Logs

**Successful Sync Request:**
```
✅ [Conga] Review posted successfully (attempt 1)
   Status: 200
Logged Conga postback for doc-001 (status: 200)
```

**Failed Async Request:**
```
❌ [Conga] All 3 attempts failed
   Last error: HTTP 503: Service Unavailable
Async Conga send failed: HTTP 503: Service Unavailable
Logged Conga postback for doc-001 (status: None)
```

**Mock Mode:**
```
🧪 [Conga Mock] Writing payload to file...
   File: ./logs/conga_mock_out.jsonl
   Document: doc-001
   Version: ver-doc-001-v3
✅ [Conga Mock] Payload written successfully
Logged Conga postback for doc-001 (status: 200)
```

### Database Queries

**Get all Conga logs for a document:**
```sql
SELECT log_id, version_id, endpoint, status_code, created_at
FROM conga_postback_logs
WHERE document_id = 'doc-001'
ORDER BY created_at DESC;
```

**Get failed requests:**
```sql
SELECT document_id, version_id, endpoint, response_body, created_at
FROM conga_postback_logs
WHERE status_code IS NULL OR status_code >= 400
ORDER BY created_at DESC;
```

**Get success rate:**
```sql
SELECT 
    COUNT(*) as total_requests,
    SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) as successful,
    ROUND(100.0 * SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM conga_postback_logs
WHERE created_at >= NOW() - INTERVAL '24 hours';
```

**Get average response time by endpoint:**
```sql
SELECT 
    endpoint,
    COUNT(*) as request_count,
    AVG(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) as avg_success_rate
FROM conga_postback_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY endpoint;
```

## Testing Checklist

### Unit Tests
- [ ] `send_review_async()` returns correct structure in all modes
- [ ] `_log_conga_postback()` handles database errors gracefully
- [ ] Async mode doesn't block main response
- [ ] Sync mode waits for Conga result

### Integration Tests
- [ ] Mock mode writes to file AND database
- [ ] Real mode logs success responses
- [ ] Real mode logs failure responses
- [ ] Retry logic logs final attempt result
- [ ] Database foreign keys work correctly

### End-to-End Tests
- [ ] Save review with Conga disabled → no log entry
- [ ] Save review with mock mode → log entry with status 200
- [ ] Save review with real API (success) → log entry with actual status
- [ ] Save review with real API (failure) → log entry with null status
- [ ] Async mode returns before Conga completes
- [ ] Sync mode returns after Conga completes

## Migration Notes

No database migration needed - `conga_postback_logs` table already exists in schema.

## Rollback Plan

If issues arise, disable Conga integration:
```env
CONGA_ENABLED=false
```

This will:
- Skip Conga API calls
- Skip database logging
- Return skipped status in response (if sync mode)

## Performance Considerations

### Async Mode (Recommended for Production)
- **Pros:** 
  - Doesn't block user response
  - Better user experience
  - Can handle slow Conga API
- **Cons:**
  - Can't return Conga result in response
  - Background failures logged but not surfaced to user

### Sync Mode (Useful for Debugging)
- **Pros:**
  - Returns Conga result immediately
  - User sees if Conga succeeded
  - Easier to debug
- **Cons:**
  - Blocks response until Conga completes
  - Can make UI slow if Conga API is slow
  - Timeout can cause 500 errors

### Database Impact
- One INSERT per review save (minimal overhead)
- JSONB storage is efficient
- No indexes needed initially (can add later if querying is slow)

## Files Modified

1. `azure_function_fastapi_replacement/conga_client.py`
   - Renamed method to `send_review_async`
   - Added explicit parameters
   - Enhanced return data with logging fields

2. `azure_function_fastapi_replacement/function_app.py`
   - Added `_log_conga_postback()` helper function
   - Updated `save_review()` to call Conga and log results
   - Enhanced response to include `congaResult` (sync mode only)

## Related Documentation

- [SCHEMA_CODE_ALIGNMENT.md](SCHEMA_CODE_ALIGNMENT.md) - Database schema analysis
- [CROSS_VERSION_UPDATE_IMPLEMENTATION.md](CROSS_VERSION_UPDATE_IMPLEMENTATION.md) - Cross-version updates
- [contract_ai_schema_postgres_redesigned.sql](azure_function_fastapi_replacement/data/contract_ai_schema_postgres_redesigned.sql) - Database schema
