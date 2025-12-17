# fastapi_server_postgresql/conga_client.py
# Conga CLM (Salesforce) integration client with mock support

import os
import json
import httpx
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

# Ensure stdout uses UTF-8 encoding (Windows compatibility)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')


def safe_print(msg: str):
    """Print with UTF-8 encoding safety for Windows console."""
    try:
        print(msg)
    except UnicodeEncodeError:
        # Fallback: replace problematic characters
        print(msg.encode('ascii', errors='replace').decode('ascii'))


class CongaClient:
    """
    Client for posting review data to Conga CLM (Salesforce).
    Supports mock mode for development and testing.
    """
    
    def __init__(self):
        # Read settings from environment
        self.enabled = os.getenv("CONGA_ENABLED", "false").lower() == "true"
        self.mock = os.getenv("CONGA_MOCK", "true").lower() == "true"
        self.base_url = os.getenv("CONGA_BASE_URL", "http://localhost:9999")
        self.review_path = os.getenv("CONGA_REVIEW_PATH", "/api/review")
        self.timeout = int(os.getenv("CONGA_TIMEOUT_SECONDS", "10"))
        self.api_key = os.getenv("CONGA_API_KEY", "")
        self.output_file = os.getenv("CONGA_OUTPUT_FILE", "./logs/conga_mock_out.jsonl")
        self.retry_count = int(os.getenv("CONGA_RETRY_COUNT", "2"))
        
        # Ensure logs directory exists for mock mode
        if self.mock and self.output_file:
            output_path = Path(self.output_file)
            output_path.parent.mkdir(parents=True, exist_ok=True)
    
    async def send_review_async(
        self,
        document_id: str,
        version_id: str,
        corrections: Dict[str, str],
        reviewer: str
    ) -> Dict[str, Any]:
        """
        Post review data to Conga CLM.
        
        Args:
            document_id: Document identifier
            version_id: Version identifier
            corrections: Dictionary of attributeKey -> correctedValue
            reviewer: Name of reviewer
            
        Returns:
            Dict with status information and logging data
        """
        
        # Build payload
        payload = {
            "documentId": document_id,
            "versionId": version_id,
            "corrections": corrections,
            "reviewer": reviewer,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # If Conga integration is disabled
        if not self.enabled:
            safe_print("⏭️  [Conga] Skipped - CONGA_ENABLED=false")
            return {
                "skipped": True,
                "reason": "CONGA_ENABLED=false",
                "timestamp": datetime.utcnow().isoformat(),
                "endpoint": None,
                "payload": payload,
                "status_code": None,
                "response_body": None
            }
        
        # Mock mode - write to file instead of real HTTP call
        if self.mock:
            try:
                safe_print("\n" + "=" * 80)
                safe_print("🧪 [Conga Mock] Writing payload to file...")
                safe_print(f"   File: {self.output_file}")
                safe_print(f"   Document: {payload.get('documentId')}")
                safe_print(f"   Version: {payload.get('versionNumber')}")
                safe_print("=" * 80)
                
                # Append as JSON line with UTF-8 encoding
                with open(self.output_file, "a", encoding="utf-8") as f:
                    mock_entry = {
                        **payload,
                        "mockedAt": datetime.utcnow().isoformat(),
                        "congaConfig": {
                            "baseUrl": self.base_url,
                            "reviewPath": self.review_path
                        }
                    }
                    f.write(json.dumps(mock_entry) + "\n")
                
                safe_print(f"✅ [Conga Mock] Payload written successfully")
                safe_print("=" * 80 + "\n")
                
                return {
                    "mocked": True,
                    "success": True,
                    "outputFile": self.output_file,
                    "timestamp": datetime.utcnow().isoformat(),
                    "endpoint": f"{self.base_url}{self.review_path}",
                    "payload": payload,
                    "status_code": 200,
                    "response_body": json.dumps({"mocked": True, "success": True})
                }
            except Exception as e:
                safe_print(f"❌ [Conga Mock] Error writing to file: {e}")
                return {
                    "mocked": True,
                    "success": False,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat(),
                    "endpoint": f"{self.base_url}{self.review_path}",
                    "payload": payload,
                    "status_code": None,
                    "response_body": json.dumps({"error": str(e)})
                }
        
        # Real mode - actual HTTP POST to Conga CLM
        try:
            safe_print("\n" + "=" * 80)
            safe_print("🔗 [Conga] Posting review to Conga CLM...")
            safe_print(f"   URL: {self.base_url}{self.review_path}")
            safe_print(f"   Document: {payload.get('documentId')}")
            safe_print(f"   Version: {payload.get('versionNumber')}")
            safe_print(f"   Retry Count: {self.retry_count}")
            safe_print("=" * 80)
            
            url = f"{self.base_url}{self.review_path}"
            headers = {"Content-Type": "application/json"}
            
            # Add authorization if API key is provided
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            # Retry logic
            last_error = None
            for attempt in range(self.retry_count + 1):
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.post(
                            url,
                            json=payload,
                            headers=headers
                        )
                        response.raise_for_status()
                        
                        safe_print(f"✅ [Conga] Review posted successfully (attempt {attempt + 1})")
                        safe_print(f"   Status: {response.status_code}")
                        safe_print("=" * 80 + "\n")
                        
                        response_body = response.text if response.text else "{}"
                        
                        return {
                            "success": True,
                            "statusCode": response.status_code,
                            "response": response.json() if response.text else {},
                            "timestamp": datetime.utcnow().isoformat(),
                            "attempt": attempt + 1,
                            "endpoint": url,
                            "payload": payload,
                            "status_code": response.status_code,
                            "response_body": response_body
                        }
                except httpx.HTTPStatusError as e:
                    last_error = f"HTTP {e.response.status_code}: {e.response.text}"
                    safe_print(f"⚠️  [Conga] Attempt {attempt + 1} failed: {last_error}")
                    if attempt < self.retry_count:
                        safe_print(f"   Retrying...")
                except httpx.RequestError as e:
                    last_error = f"Request error: {str(e)}"
                    safe_print(f"⚠️  [Conga] Attempt {attempt + 1} failed: {last_error}")
                    if attempt < self.retry_count:
                        safe_print(f"   Retrying...")
            
            # All retries exhausted
            safe_print(f"❌ [Conga] All {self.retry_count + 1} attempts failed")
            safe_print(f"   Last error: {last_error}")
            safe_print("=" * 80 + "\n")
            
            return {
                "success": False,
                "error": last_error,
                "timestamp": datetime.utcnow().isoformat(),
                "attempts": self.retry_count + 1,
                "endpoint": url,
                "payload": payload,
                "status_code": None,
                "response_body": json.dumps({"error": last_error})
            }
            
        except Exception as e:
            safe_print(f"❌ [Conga] Unexpected error: {e}")
            safe_print("=" * 80 + "\n")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
                "endpoint": f"{self.base_url}{self.review_path}",
                "payload": payload,
                "status_code": None,
                "response_body": json.dumps({"error": str(e)})
            }


# Singleton instance
_conga_client = None

def get_conga_client() -> CongaClient:
    """Get or create the Conga client singleton."""
    global _conga_client
    if _conga_client is None:
        _conga_client = CongaClient()
    return _conga_client
