"""
Quick verification script for Azure Functions setup
"""
import sys
import subprocess

print("=" * 60)
print("Azure Functions Environment Verification")
print("=" * 60)

# Check Python version
print("\n1. Checking Python version...")
version = sys.version_info
print(f"   ✓ Python {version.major}.{version.minor}.{version.micro}")
if version.major == 3 and 9 <= version.minor <= 11:
    print("   ✓ Python version compatible with Azure Functions")
else:
    print("   ⚠ Warning: Azure Functions works best with Python 3.9-3.11")

# Check Azure Functions Core Tools
print("\n2. Checking Azure Functions Core Tools...")
try:
    result = subprocess.run(['func', '--version'], capture_output=True, text=True, shell=True)
    if result.returncode == 0:
        print(f"   ✓ Azure Functions Core Tools: {result.stdout.strip()}")
    else:
        print("   ✗ Azure Functions Core Tools not found")
except Exception as e:
    print(f"   ✗ Error checking func: {e}")

# Check required packages
print("\n3. Checking required packages...")
packages = ['azure.functions', 'psycopg2']
for pkg in packages:
    try:
        __import__(pkg.replace('-', '_'))
        print(f"   ✓ {pkg} installed")
    except ImportError:
        print(f"   ✗ {pkg} NOT installed - run: pip install -r requirements.txt")

# Check database connectivity
print("\n4. Testing PostgreSQL connection...")
try:
    import psycopg2
    import os
    
    # Try to read from local.settings.json
    import json
    try:
        with open('local.settings.json', 'r') as f:
            settings = json.load(f)
            values = settings.get('Values', {})
            
        conn_params = {
            'host': values.get('DB_HOST', 'localhost'),
            'port': int(values.get('DB_PORT', 5432)),
            'dbname': values.get('DB_NAME', 'contract_ai_postgres_db'),
            'user': values.get('DB_USER', 'postgres'),
            'password': values.get('DB_PASSWORD', 'password')
        }
        
        # Add SSL for Azure PostgreSQL
        if 'postgres.database.azure.com' in conn_params['host']:
            conn_params['sslmode'] = 'require'
            print(f"   ℹ Using SSL connection for Azure PostgreSQL")
        
        conn = psycopg2.connect(**conn_params)
        print(f"   ✓ Connected to {values.get('DB_NAME')} at {values.get('DB_HOST')}")
        
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM documents')
        count = cur.fetchone()[0]
        print(f"   ✓ Found {count} documents in database")
        
        cur.execute('SELECT COUNT(*) FROM document_versions')
        version_count = cur.fetchone()[0]
        print(f"   ✓ Found {version_count} document versions")
        
        conn.close()
    except FileNotFoundError:
        print("   ⚠ local.settings.json not found")
    except Exception as db_err:
        print(f"   ✗ Database connection failed: {db_err}")
except ImportError:
    print("   ⚠ psycopg2 not installed")

print("\n" + "=" * 60)
print("Setup verification complete!")
print("=" * 60)
print("\nTo start the Azure Function:")
print("  func start")
print("\nTo start on a specific port:")
print("  func start --port 8080")
print("\n" + "=" * 60)
