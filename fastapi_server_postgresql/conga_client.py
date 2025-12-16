# fastapi_server_postgresql/conga_client.py
# Conga CLM (Salesforce) integration client with mock support

import os
import json
import httpx
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional


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
    
    async def post_review(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post review data to Conga CLM.
        
        Args:
            payload: Review data including documentId, attributes, etc.
            
        Returns:
            Dict with status information
        """
        
        # If Conga integration is disabled
        if not self.enabled:
            print("⏭️  [Conga] Skipped - CONGA_ENABLED=false")
            return {
                "skipped": True,
                "reason": "CONGA_ENABLED=false",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Mock mode - write to file instead of real HTTP call
        if self.mock:
            try:
                print("\n" + "=" * 80)
                print("🧪 [Conga Mock] Writing payload to file...")
                print(f"   File: {self.output_file}")
                print(f"   Document: {payload.get('documentId')}")
                print(f"   Version: {payload.get('versionNumber')}")
                print("=" * 80)
                
                # Append as JSON line
                with open(self.output_file, "a") as f:
                    mock_entry = {
                        **payload,
                        "mockedAt": datetime.utcnow().isoformat(),
                        "congaConfig": {
                            "baseUrl": self.base_url,
                            "reviewPath": self.review_path
                        }
                    }
                    f.write(json.dumps(mock_entry) + "\n")
                
                print(f"✅ [Conga Mock] Payload written successfully")
                print("=" * 80 + "\n")
                
                return {
                    "mocked": True,
                    "success": True,
                    "outputFile": self.output_file,
                    "timestamp": datetime.utcnow().isoformat()
                }
            except Exception as e:
                print(f"❌ [Conga Mock] Error writing to file: {e}")
                return {
                    "mocked": True,
                    "success": False,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                }
        
        # Real mode - actual HTTP POST to Conga CLM
        try:
            print("\n" + "=" * 80)
            print("🔗 [Conga] Posting review to Conga CLM...")
            print(f"   URL: {self.base_url}{self.review_path}")
            print(f"   Document: {payload.get('documentId')}")
            print(f"   Version: {payload.get('versionNumber')}")
            print(f"   Retry Count: {self.retry_count}")
            print("=" * 80)
            
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
                        
                        print(f"✅ [Conga] Review posted successfully (attempt {attempt + 1})")
                        print(f"   Status: {response.status_code}")
                        print("=" * 80 + "\n")
                        
                        return {
                            "success": True,
                            "statusCode": response.status_code,
                            "response": response.json() if response.text else {},
                            "timestamp": datetime.utcnow().isoformat(),
                            "attempt": attempt + 1
                        }
                except httpx.HTTPStatusError as e:
                    last_error = f"HTTP {e.response.status_code}: {e.response.text}"
                    print(f"⚠️  [Conga] Attempt {attempt + 1} failed: {last_error}")
                    if attempt < self.retry_count:
                        print(f"   Retrying...")
                except httpx.RequestError as e:
                    last_error = f"Request error: {str(e)}"
                    print(f"⚠️  [Conga] Attempt {attempt + 1} failed: {last_error}")
                    if attempt < self.retry_count:
                        print(f"   Retrying...")
            
            # All retries exhausted
            print(f"❌ [Conga] All {self.retry_count + 1} attempts failed")
            print(f"   Last error: {last_error}")
            print("=" * 80 + "\n")
            
            return {
                "success": False,
                "error": last_error,
                "timestamp": datetime.utcnow().isoformat(),
                "attempts": self.retry_count + 1
            }
            
        except Exception as e:
            print(f"❌ [Conga] Unexpected error: {e}")
            print("=" * 80 + "\n")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }


# Singleton instance
_conga_client = None

def get_conga_client() -> CongaClient:
    """Get or create the Conga client singleton."""
    global _conga_client
    if _conga_client is None:
        _conga_client = CongaClient()
    return _conga_client
