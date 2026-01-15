# Database Migration: Supabase to AWS RDS

> **Step-by-step guide to migrate your PostgreSQL data**

---

## Overview

```
┌─────────────────┐         ┌─────────────────┐
│    Supabase     │  ────▶  │    AWS RDS      │
│   PostgreSQL    │         │   PostgreSQL    │
└─────────────────┘         └─────────────────┘
     Source                      Target
```

**Migration Steps:**
1. Export schema from Supabase
2. Convert Supabase-specific features
3. Create target database
4. Import schema
5. Migrate data
6. Validate

---

## Prerequisites

```bash
# Install PostgreSQL client tools
# macOS
brew install postgresql@15

# Ubuntu
sudo apt-get install postgresql-client-15

# Verify
psql --version
pg_dump --version
```

### Required Credentials

```bash
# Supabase (Source)
export SUPABASE_HOST="db.ofjgwusjzgjkfwumzwwy.supabase.co"
export SUPABASE_PORT="5432"
export SUPABASE_DB="postgres"
export SUPABASE_USER="postgres"
export SUPABASE_PASSWORD="your-supabase-password"
export SUPABASE_URL="postgresql://${SUPABASE_USER}:${SUPABASE_PASSWORD}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}"

# AWS RDS (Target)
export RDS_HOST="tms-prod-db.xxxxx.ap-south-1.rds.amazonaws.com"
export RDS_PORT="5432"
export RDS_DB="tms_production"
export RDS_USER="postgres"
export RDS_PASSWORD="your-rds-password"
export RDS_URL="postgresql://${RDS_USER}:${RDS_PASSWORD}@${RDS_HOST}:${RDS_PORT}/${RDS_DB}"
```

---

## Step 1: Create Backup

```bash
# Create backup directory
mkdir -p migration/backup

# Full backup (safety copy)
pg_dump "$SUPABASE_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="migration/backup/full_backup.dump"

echo "Backup created: migration/backup/full_backup.dump"
```

---

## Step 2: Export Schema

```bash
# Export public schema
pg_dump "$SUPABASE_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-acl \
  --file="migration/01_schema.sql"

echo "Schema exported to migration/01_schema.sql"
```

---

## Step 3: Convert Schema

Create `migration/02_converted_schema.sql` with Supabase-specific changes:

```sql
-- migration/02_converted_schema.sql

-- ================================================
-- 1. CREATE ENUMS (same as Supabase)
-- ================================================

CREATE TYPE app_role AS ENUM ('superadmin', 'admin', 'user');
CREATE TYPE consent_status AS ENUM ('not_requested', 'requested', 'granted', 'revoked', 'expired');
CREATE TYPE driver_consent_status AS ENUM ('pending', 'allowed', 'not_allowed', 'expired');
CREATE TYPE exception_status AS ENUM ('open', 'acknowledged', 'resolved', 'escalated');
CREATE TYPE freight_type AS ENUM ('ftl', 'ptl', 'express');
CREATE TYPE location_type AS ENUM ('node', 'consignee', 'plant', 'warehouse', 'distribution_center');
CREATE TYPE permission_action AS ENUM ('read', 'write', 'delete');
CREATE TYPE permission_resource AS ENUM ('users', 'trips', 'shipments', 'settings');
CREATE TYPE serviceability_mode AS ENUM ('surface', 'air', 'rail');
CREATE TYPE shipment_exception_type AS ENUM (
  'duplicate_mapping', 'capacity_exceeded', 'vehicle_not_arrived',
  'loading_discrepancy', 'tracking_unavailable', 'ndr_consignee_unavailable',
  'pod_rejected', 'invoice_dispute', 'delay_exceeded', 'weight_mismatch', 'other'
);
CREATE TYPE shipment_status AS ENUM (
  'created', 'confirmed', 'mapped', 'in_pickup', 'in_transit',
  'out_for_delivery', 'delivered', 'ndr', 'returned', 'success'
);
CREATE TYPE tracking_asset_type AS ENUM ('gps', 'sim', 'whatsapp', 'driver_app');
CREATE TYPE tracking_source AS ENUM ('telenity', 'wheelseye', 'manual');
CREATE TYPE tracking_type AS ENUM ('gps', 'sim', 'manual', 'none');
CREATE TYPE trip_alert_type AS ENUM (
  'route_deviation', 'stoppage', 'idle_time', 'tracking_lost',
  'consent_revoked', 'geofence_entry', 'geofence_exit', 'speed_exceeded', 'delay_warning'
);
CREATE TYPE trip_status AS ENUM ('created', 'ongoing', 'completed', 'cancelled', 'on_hold', 'closed');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'dismissed');

-- ================================================
-- 2. CREATE APP_USERS TABLE (replaces auth.users)
-- ================================================

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  encrypted_password TEXT NOT NULL,
  email_confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_users_email ON app_users(email);

-- ================================================
-- 3. MODIFY PROFILES TABLE
-- ================================================

-- Original references auth.users, change to app_users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE;

-- ================================================
-- 4. MODIFY USER_ROLES TABLE
-- ================================================

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
-- Note: user_roles.user_id now references app_users instead of auth.users

-- ================================================
-- 5. CREATE HELPER FUNCTIONS
-- ================================================

-- Replace auth.uid() with app-level function
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
BEGIN
  -- In Lambda, user ID will be passed in request context
  -- This is a placeholder for compatibility
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Step 4: Export Data

```bash
# Export data only (no schema)
pg_dump "$SUPABASE_URL" \
  --schema=public \
  --data-only \
  --no-owner \
  --file="migration/03_data.sql"

echo "Data exported to migration/03_data.sql"
```

---

## Step 5: Create Target Database

```bash
# Connect to RDS and create database
psql "postgresql://${RDS_USER}:${RDS_PASSWORD}@${RDS_HOST}:${RDS_PORT}/postgres" << EOF
CREATE DATABASE tms_production;
\c tms_production
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOF

echo "Database created: tms_production"
```

---

## Step 6: Import to RDS

```bash
# Import converted schema
psql "$RDS_URL" -f migration/02_converted_schema.sql

# Import original schema (tables)
psql "$RDS_URL" -f migration/01_schema.sql

# Import data
psql "$RDS_URL" -f migration/03_data.sql

echo "Migration complete!"
```

---

## Step 7: Migrate Users

Users from Supabase auth need to be migrated to the new `app_users` table:

```sql
-- Run this after data migration
-- You'll need to export auth.users from Supabase dashboard first

INSERT INTO app_users (id, email, encrypted_password, email_confirmed_at, created_at)
SELECT 
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at
FROM auth_users_export;  -- Your exported auth.users data
```

---

## Step 8: Validate Migration

```bash
# Create validation script
cat > migration/validate.sql << 'EOF'
-- Count records in each table
SELECT 'trips' as table_name, COUNT(*) as count FROM trips
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'drivers', COUNT(*) FROM drivers
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'locations', COUNT(*) FROM locations
UNION ALL
SELECT 'transporters', COUNT(*) FROM transporters
ORDER BY table_name;
EOF

# Run on Supabase
echo "=== SUPABASE COUNTS ==="
psql "$SUPABASE_URL" -f migration/validate.sql

# Run on RDS
echo "=== RDS COUNTS ==="
psql "$RDS_URL" -f migration/validate.sql
```

Compare the counts - they should match!

---

## Automated Migration Script

```bash
#!/bin/bash
# migration/migrate.sh

set -e  # Exit on error

echo "======================================"
echo "TMS Database Migration: Supabase → RDS"
echo "======================================"

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$RDS_URL" ]; then
  echo "Error: Set SUPABASE_URL and RDS_URL environment variables"
  exit 1
fi

# Step 1: Backup
echo "[1/6] Creating backup..."
mkdir -p backup
pg_dump "$SUPABASE_URL" --no-owner --format=custom -f backup/full_backup.dump
echo "✓ Backup created"

# Step 2: Export schema
echo "[2/6] Exporting schema..."
pg_dump "$SUPABASE_URL" --schema=public --schema-only --no-owner -f 01_schema.sql
echo "✓ Schema exported"

# Step 3: Export data
echo "[3/6] Exporting data..."
pg_dump "$SUPABASE_URL" --schema=public --data-only --no-owner -f 03_data.sql
echo "✓ Data exported"

# Step 4: Create database
echo "[4/6] Creating target database..."
psql "${RDS_URL%/*}/postgres" -c "CREATE DATABASE tms_production;" 2>/dev/null || true
echo "✓ Database ready"

# Step 5: Import
echo "[5/6] Importing to RDS..."
psql "$RDS_URL" -f 02_converted_schema.sql
psql "$RDS_URL" -f 01_schema.sql
psql "$RDS_URL" -f 03_data.sql
echo "✓ Data imported"

# Step 6: Validate
echo "[6/6] Validating..."
psql "$RDS_URL" -c "SELECT COUNT(*) as trip_count FROM trips;"
echo "✓ Validation complete"

echo "======================================"
echo "Migration completed successfully!"
echo "======================================"
```

Make it executable and run:

```bash
chmod +x migration/migrate.sh
./migration/migrate.sh
```

---

## Rollback Procedure

If migration fails:

```bash
# Restore from backup
pg_restore \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -d "$RDS_URL" \
  backup/full_backup.dump
```

---

## Post-Migration Checklist

- [ ] All table counts match between source and target
- [ ] Foreign key relationships intact
- [ ] Indexes created properly
- [ ] User accounts accessible
- [ ] Application connects successfully
- [ ] Queries return expected data
- [ ] Performance is acceptable

---

## Handling RLS → Application Auth

Supabase RLS policies must be replaced with application-level authorization:

### Before (Supabase RLS)

```sql
CREATE POLICY "Users can view their trips"
ON trips FOR SELECT
USING (auth.uid() = created_by);
```

### After (Lambda Authorization)

```typescript
// In Lambda handler
async function getTrips(userId: string) {
  const result = await pool.query(
    `SELECT * FROM trips 
     WHERE created_by = $1 
     OR EXISTS (
       SELECT 1 FROM user_roles 
       WHERE user_id = $1 AND role = 'admin'
     )`,
    [userId]
  );
  return result.rows;
}
```

---

## Common Issues

### "Permission denied" during export

```bash
# Use the pooler connection instead of direct
export SUPABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-region.pooler.supabase.com:6543/postgres"
```

### "Relation does not exist"

```bash
# Ensure you're importing in the correct order:
# 1. Extensions
# 2. Types/Enums
# 3. Tables
# 4. Data
# 5. Indexes
# 6. Constraints
```

### Data type mismatch

```sql
-- Check for any custom types that need conversion
SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace;
```
