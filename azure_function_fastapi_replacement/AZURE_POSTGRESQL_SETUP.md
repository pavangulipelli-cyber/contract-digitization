# Azure PostgreSQL Firewall Configuration Guide

## Problem
Azure PostgreSQL blocks connections by default. You need to add your IP address to the firewall rules.

## Solution 1: Add Firewall Rule via Azure Portal (Recommended)

### Steps:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your PostgreSQL server: `psql-napd-pricing-contractiq`
3. In the left menu, click **"Networking"** or **"Connection security"**
4. Under **Firewall rules**, click **"Add current client IP address"** or **"Add 0.0.0.0 - 255.255.255.255"** (for testing only!)
5. Click **"Save"** at the top
6. Wait 1-2 minutes for the rule to propagate

### Using Azure CLI:
```powershell
# Get your current IP
$myIP = (Invoke-WebRequest -Uri "https://api.ipify.org").Content

# Add firewall rule
az postgres server firewall-rule create `
  --resource-group <your-resource-group> `
  --server-name psql-napd-pricing-contractiq `
  --name AllowMyIP `
  --start-ip-address $myIP `
  --end-ip-address $myIP
```

### For Development (Allow all IPs - NOT RECOMMENDED FOR PRODUCTION):
```powershell
az postgres server firewall-rule create `
  --resource-group <your-resource-group> `
  --server-name psql-napd-pricing-contractiq `
  --name AllowAll `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 255.255.255.255
```

## Solution 2: Use Local PostgreSQL for Development

If you can't access Azure PostgreSQL, set up a local instance:

### Install PostgreSQL Locally:
1. Download from: https://www.postgresql.org/download/windows/
2. Run installer (default settings are fine)
3. Remember the password you set for `postgres` user

### Update local.settings.json:
```json
{
  "Values": {
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "DB_NAME": "contract_ai_postgres_db",
    "DB_USER": "postgres",
    "DB_PASSWORD": "your-local-password"
  }
}
```

### Create Database and Schema:
```powershell
# Connect to PostgreSQL
psql -U postgres

# In psql prompt:
CREATE DATABASE contract_ai_postgres_db;
\c contract_ai_postgres_db

# Run schema and seed files
\i 'C:/Users/gulip/OneDrive/Desktop/contract-digitization-backend/fastapi_server_postgresql/data/contract_ai_schema_postgres_redesigned.sql'
\i 'C:/Users/gulip/OneDrive/Desktop/contract-digitization-backend/fastapi_server_postgresql/data/contract_ai_seed_postgres_redesigned_updated.sql'
```

## Solution 3: Test Connection from Azure

Deploy the function to Azure - it will have network access automatically:

```powershell
# Login to Azure
az login

# Deploy function
cd c:\Users\gulip\OneDrive\Desktop\contract-digitization-backend\azure_function_fastapi_replacement
func azure functionapp publish <your-function-app-name>
```

## Verify Connection After Firewall Update

After adding firewall rules, test again:

```powershell
cd c:\Users\gulip\OneDrive\Desktop\contract-digitization-backend\azure_function_fastapi_replacement
python verify_setup.py
```

## Quick Connection Test

```powershell
# Test with SSL enabled
python -c "import psycopg2; conn = psycopg2.connect(host='psql-napd-pricing-contractiq.postgres.database.azure.com', port=5432, dbname='contract_ai_postgres_db', user='psqladmin', password='AbpCfnuL?9TCnZzxW?_v7f7eW1RoKY', sslmode='require'); print('✓ Connected successfully!'); conn.close()"
```

## Common Issues

### Issue: Still can't connect after adding firewall rule
- Wait 2-3 minutes after adding the rule
- Verify your current IP: Visit https://whatismyip.com
- Check if you're behind a VPN or proxy
- Try adding IP range instead of single IP

### Issue: SSL error
- Ensure `sslmode='require'` is in connection parameters
- Azure PostgreSQL requires SSL by default

### Issue: Authentication failed
- Double-check username format: `psqladmin@psql-napd-pricing-contractiq` or just `psqladmin`
- Verify password is correct
- Check if account is active

## Next Steps

Once connection works:
1. Run `python verify_setup.py` - should show ✓ for database connection
2. Run `func start` - Function should start without errors
3. Test endpoints with the commands in TEST_COMMANDS.md
