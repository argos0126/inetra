# Database Migration Scripts: Supabase to AWS RDS PostgreSQL

This document provides step-by-step scripts and procedures for migrating the TMS database from Supabase to AWS RDS PostgreSQL.

## Table of Contents

1. [Pre-Migration Checklist](#pre-migration-checklist)
2. [Phase 1: Schema Export & Conversion](#phase-1-schema-export--conversion)
3. [Phase 2: Create Target Database](#phase-2-create-target-database)
4. [Phase 3: Schema Migration](#phase-3-schema-migration)
5. [Phase 4: Data Migration](#phase-4-data-migration)
6. [Phase 5: Post-Migration Validation](#phase-5-post-migration-validation)
7. [Rollback Procedures](#rollback-procedures)

---

## Pre-Migration Checklist

### Environment Variables Required

```bash
# Source (Supabase)
export SUPABASE_DB_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
export SUPABASE_PROJECT_REF="ofjgwusjzgjkfwumzwwy"

# Target (AWS RDS)
export RDS_HOST="your-rds-instance.region.rds.amazonaws.com"
export RDS_PORT="5432"
export RDS_DATABASE="tms_production"
export RDS_USER="postgres"
export RDS_PASSWORD="your-secure-password"
export RDS_URL="postgresql://${RDS_USER}:${RDS_PASSWORD}@${RDS_HOST}:${RDS_PORT}/${RDS_DATABASE}"
```

### Required Tools

```bash
# Install required tools
brew install postgresql@15  # or apt-get install postgresql-client-15
pip install pgloader
npm install -g @supabase/cli
```

### Pre-Migration Backup

```bash
#!/bin/bash
# backup-supabase.sh

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating full database backup..."
pg_dump "$SUPABASE_DB_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="$BACKUP_DIR/full_backup.dump"

echo "Creating schema-only backup..."
pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --file="$BACKUP_DIR/schema_only.sql"

echo "Creating data-only backup..."
pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --file="$BACKUP_DIR/data_only.sql"

echo "Backup complete: $BACKUP_DIR"
```

---

## Phase 1: Schema Export & Conversion

### Step 1.1: Export Supabase Schema

```bash
#!/bin/bash
# export-schema.sh

OUTPUT_DIR="./migration/schema"
mkdir -p "$OUTPUT_DIR"

# Export public schema tables
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-acl \
  --no-comments \
  --file="$OUTPUT_DIR/01_public_schema.sql"

# Export enum types separately
psql "$SUPABASE_DB_URL" -t -A -c "
SELECT 'CREATE TYPE ' || n.nspname || '.' || t.typname || ' AS ENUM (' ||
       string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ');'
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname;
" > "$OUTPUT_DIR/00_enums.sql"

# Export functions
psql "$SUPABASE_DB_URL" -t -A -c "
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f';
" > "$OUTPUT_DIR/02_functions.sql"

echo "Schema exported to $OUTPUT_DIR"
```

### Step 1.2: Schema Conversion Script

```sql
-- migration/schema/03_converted_schema.sql
-- This script converts Supabase-specific schema to standard PostgreSQL

-- =====================================================
-- SECTION 1: Create Custom Types (Enums)
-- =====================================================

DO $$ 
BEGIN
    -- Drop existing types if they exist (for re-runs)
    DROP TYPE IF EXISTS app_role CASCADE;
    DROP TYPE IF EXISTS consent_status CASCADE;
    DROP TYPE IF EXISTS driver_consent_status CASCADE;
    DROP TYPE IF EXISTS exception_status CASCADE;
    DROP TYPE IF EXISTS freight_type CASCADE;
    DROP TYPE IF EXISTS location_type CASCADE;
    DROP TYPE IF EXISTS serviceability_mode CASCADE;
    DROP TYPE IF EXISTS shipment_exception_type CASCADE;
    DROP TYPE IF EXISTS shipment_status CASCADE;
    DROP TYPE IF EXISTS tracking_asset_type CASCADE;
    DROP TYPE IF EXISTS tracking_source CASCADE;
    DROP TYPE IF EXISTS tracking_type CASCADE;
    DROP TYPE IF EXISTS trip_alert_type CASCADE;
    DROP TYPE IF EXISTS trip_status CASCADE;
    DROP TYPE IF EXISTS alert_status CASCADE;
END $$;

-- Create enums
CREATE TYPE app_role AS ENUM ('superadmin', 'admin', 'user');

CREATE TYPE consent_status AS ENUM (
    'not_requested', 'requested', 'granted', 'revoked', 'expired'
);

CREATE TYPE driver_consent_status AS ENUM (
    'pending', 'allowed', 'not_allowed', 'expired'
);

CREATE TYPE exception_status AS ENUM (
    'open', 'acknowledged', 'resolved', 'escalated'
);

CREATE TYPE freight_type AS ENUM ('ftl', 'ptl', 'express');

CREATE TYPE location_type AS ENUM (
    'node', 'consignee', 'plant', 'warehouse', 'distribution_center'
);

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

CREATE TYPE trip_status AS ENUM (
    'created', 'ongoing', 'completed', 'cancelled', 'on_hold', 'closed'
);

CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'dismissed');

-- =====================================================
-- SECTION 2: Create Users Table (Replaces auth.users)
-- =====================================================

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    email_confirmed_at TIMESTAMPTZ,
    invited_at TIMESTAMPTZ,
    confirmation_token TEXT,
    confirmation_sent_at TIMESTAMPTZ,
    recovery_token TEXT,
    recovery_sent_at TIMESTAMPTZ,
    email_change_token TEXT,
    email_change TEXT,
    email_change_sent_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    is_super_admin BOOLEAN DEFAULT FALSE,
    phone TEXT,
    phone_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    banned_until TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_phone ON app_users(phone);

-- =====================================================
-- SECTION 3: Create Core Tables
-- =====================================================

-- Profiles table (links to app_users instead of auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    company_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gst_number TEXT,
    pan_number TEXT,
    integration_code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transporters
CREATE TABLE IF NOT EXISTS transporters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transporter_name TEXT NOT NULL,
    code TEXT,
    company TEXT,
    email TEXT,
    mobile TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gstin TEXT,
    pan TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicle Types
CREATE TABLE IF NOT EXISTS vehicle_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name TEXT NOT NULL,
    length_cm NUMERIC,
    breadth_cm NUMERIC,
    height_cm NUMERIC,
    weight_capacity_kg NUMERIC,
    volume_capacity_cbm NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracking Assets
CREATE TABLE IF NOT EXISTS tracking_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    asset_type tracking_asset_type NOT NULL,
    asset_id TEXT,
    api_url TEXT,
    api_token TEXT,
    response_json_mapping JSONB,
    transporter_id UUID REFERENCES transporters(id),
    last_validated_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_number TEXT NOT NULL,
    vehicle_type_id UUID REFERENCES vehicle_types(id),
    transporter_id UUID REFERENCES transporters(id),
    tracking_asset_id UUID REFERENCES tracking_assets(id),
    make TEXT,
    model TEXT,
    year INTEGER,
    rc_number TEXT,
    rc_issue_date DATE,
    rc_expiry_date DATE,
    insurance_number TEXT,
    insurance_issue_date DATE,
    insurance_expiry_date DATE,
    fitness_number TEXT,
    fitness_issue_date DATE,
    fitness_expiry_date DATE,
    permit_number TEXT,
    permit_issue_date DATE,
    permit_expiry_date DATE,
    puc_number TEXT,
    puc_issue_date DATE,
    puc_expiry_date DATE,
    integration_code TEXT,
    location_code TEXT,
    is_dedicated BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    transporter_id UUID REFERENCES transporters(id),
    license_number TEXT,
    license_issue_date DATE,
    license_expiry_date DATE,
    aadhaar_number TEXT,
    aadhaar_verified BOOLEAN DEFAULT FALSE,
    pan_number TEXT,
    pan_verified BOOLEAN DEFAULT FALSE,
    voter_id TEXT,
    passport_number TEXT,
    police_verification_date DATE,
    police_verification_expiry DATE,
    location_code TEXT,
    consent_status consent_status NOT NULL DEFAULT 'not_requested',
    is_dedicated BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Driver Documents
CREATE TABLE IF NOT EXISTS driver_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name TEXT NOT NULL,
    location_type location_type NOT NULL DEFAULT 'node',
    customer_id UUID REFERENCES customers(id),
    address TEXT,
    city TEXT,
    state TEXT,
    district TEXT,
    pincode TEXT,
    zone TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    gps_radius_meters INTEGER DEFAULT 200,
    sim_radius_meters INTEGER DEFAULT 500,
    integration_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Serviceability Lanes
CREATE TABLE IF NOT EXISTS serviceability_lanes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lane_code TEXT NOT NULL,
    origin_location_id UUID NOT NULL REFERENCES locations(id),
    destination_location_id UUID NOT NULL REFERENCES locations(id),
    transporter_id UUID REFERENCES transporters(id),
    vehicle_type_id UUID REFERENCES vehicle_types(id),
    freight_type freight_type NOT NULL DEFAULT 'ftl',
    serviceability_mode serviceability_mode NOT NULL DEFAULT 'surface',
    distance_km NUMERIC,
    standard_tat_hours INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lane Route Calculations
CREATE TABLE IF NOT EXISTS lane_route_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lane_id UUID NOT NULL UNIQUE REFERENCES serviceability_lanes(id),
    total_distance_meters INTEGER,
    total_duration_seconds INTEGER,
    encoded_polyline TEXT,
    waypoints JSONB DEFAULT '[]'::jsonb,
    route_summary TEXT,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materials
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku_code TEXT,
    description TEXT,
    packaging TEXT,
    units TEXT,
    length_cm NUMERIC,
    breadth_cm NUMERIC,
    height_cm NUMERIC,
    weight_kg NUMERIC,
    volume_cbm NUMERIC,
    is_bulk BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Driver Consents
CREATE TABLE IF NOT EXISTS driver_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    trip_id UUID, -- FK added after trips table
    msisdn TEXT NOT NULL,
    entity_id TEXT,
    consent_status driver_consent_status NOT NULL DEFAULT 'pending',
    consent_requested_at TIMESTAMPTZ,
    consent_received_at TIMESTAMPTZ,
    consent_expires_at TIMESTAMPTZ,
    telenity_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_code TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id),
    transporter_id UUID REFERENCES transporters(id),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES drivers(id),
    origin_location_id UUID REFERENCES locations(id),
    destination_location_id UUID REFERENCES locations(id),
    lane_id UUID REFERENCES serviceability_lanes(id),
    tracking_asset_id UUID REFERENCES tracking_assets(id),
    sim_consent_id UUID REFERENCES driver_consents(id),
    tracking_type tracking_type DEFAULT 'none',
    status trip_status NOT NULL DEFAULT 'created',
    consignee_name TEXT,
    notes TEXT,
    planned_start_time TIMESTAMPTZ,
    planned_end_time TIMESTAMPTZ,
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    planned_eta TIMESTAMPTZ,
    current_eta TIMESTAMPTZ,
    total_distance_km NUMERIC,
    is_trackable BOOLEAN DEFAULT TRUE,
    last_ping_at TIMESTAMPTZ,
    active_alert_count INTEGER DEFAULT 0,
    closed_by UUID REFERENCES app_users(id),
    closed_at TIMESTAMPTZ,
    closure_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from driver_consents to trips
ALTER TABLE driver_consents ADD CONSTRAINT fk_driver_consents_trip 
    FOREIGN KEY (trip_id) REFERENCES trips(id);

-- Shipments
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_code TEXT NOT NULL,
    order_id TEXT,
    lr_number TEXT,
    waybill_number TEXT,
    consignee_code TEXT,
    customer_id UUID REFERENCES customers(id),
    trip_id UUID REFERENCES trips(id),
    material_id UUID REFERENCES materials(id),
    pickup_location_id UUID REFERENCES locations(id),
    drop_location_id UUID REFERENCES locations(id),
    shipment_type TEXT DEFAULT 'single_single',
    status shipment_status NOT NULL DEFAULT 'created',
    sub_status TEXT,
    quantity INTEGER,
    weight_kg NUMERIC,
    volume_cbm NUMERIC,
    length_cm NUMERIC,
    breadth_cm NUMERIC,
    height_cm NUMERIC,
    planned_pickup_time TIMESTAMPTZ,
    planned_delivery_time TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    mapped_at TIMESTAMPTZ,
    in_pickup_at TIMESTAMPTZ,
    loading_started_at TIMESTAMPTZ,
    loading_completed_at TIMESTAMPTZ,
    in_transit_at TIMESTAMPTZ,
    out_for_delivery_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    ndr_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    success_at TIMESTAMPTZ,
    pod_collected BOOLEAN NOT NULL DEFAULT FALSE,
    pod_collected_at TIMESTAMPTZ,
    pod_file_path TEXT,
    pod_file_name TEXT,
    pod_cleaned_at TIMESTAMPTZ,
    billed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    is_delayed BOOLEAN DEFAULT FALSE,
    delay_percentage NUMERIC,
    has_open_exception BOOLEAN DEFAULT FALSE,
    exception_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trip Shipment Map
CREATE TABLE IF NOT EXISTS trip_shipment_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    sequence_order INTEGER NOT NULL DEFAULT 0,
    mapped_by UUID REFERENCES profiles(id),
    mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trip Waypoints
CREATE TABLE IF NOT EXISTS trip_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    location_id UUID REFERENCES locations(id),
    waypoint_name TEXT NOT NULL,
    waypoint_type TEXT NOT NULL DEFAULT 'stop',
    sequence_order INTEGER NOT NULL DEFAULT 0,
    latitude NUMERIC,
    longitude NUMERIC,
    planned_arrival_time TIMESTAMPTZ,
    planned_departure_time TIMESTAMPTZ,
    actual_arrival_time TIMESTAMPTZ,
    actual_departure_time TIMESTAMPTZ,
    delay_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'upcoming',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trip Alerts
CREATE TABLE IF NOT EXISTS trip_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    alert_type trip_alert_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status alert_status NOT NULL DEFAULT 'active',
    location_latitude NUMERIC,
    location_longitude NUMERIC,
    threshold_value NUMERIC,
    actual_value NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trip Audit Logs
CREATE TABLE IF NOT EXISTS trip_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    previous_status trip_status,
    new_status trip_status NOT NULL,
    changed_by UUID REFERENCES profiles(id),
    change_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipment Exceptions
CREATE TABLE IF NOT EXISTS shipment_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    exception_type shipment_exception_type NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status exception_status NOT NULL DEFAULT 'open',
    resolution_path TEXT,
    resolution_notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    escalated_to TEXT,
    escalated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipment Status History
CREATE TABLE IF NOT EXISTS shipment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    previous_status TEXT,
    new_status TEXT NOT NULL,
    previous_sub_status TEXT,
    new_sub_status TEXT,
    changed_by UUID REFERENCES profiles(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    change_source TEXT DEFAULT 'manual',
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracking Logs
CREATE TABLE IF NOT EXISTS tracking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL UNIQUE REFERENCES trips(id),
    tracking_asset_id UUID REFERENCES tracking_assets(id),
    source TEXT,
    location_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_responses JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_sequence_number INTEGER NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Location History
CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id),
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES drivers(id),
    tracking_asset_id UUID REFERENCES tracking_assets(id),
    source tracking_source NOT NULL DEFAULT 'manual',
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    speed_kmph NUMERIC,
    heading NUMERIC,
    altitude_meters NUMERIC,
    accuracy_meters NUMERIC,
    raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consent Logs
CREATE TABLE IF NOT EXISTS consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    trip_id UUID REFERENCES trips(id),
    status consent_status NOT NULL,
    requested_at TIMESTAMPTZ,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Integration Tokens
CREATE TABLE IF NOT EXISTS integration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_type TEXT NOT NULL,
    token_value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracking Settings
CREATE TABLE IF NOT EXISTS tracking_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SECTION 4: Create Indexes
-- =====================================================

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_vehicles_transporter_id ON vehicles(transporter_id);
CREATE INDEX idx_vehicles_vehicle_type_id ON vehicles(vehicle_type_id);
CREATE INDEX idx_drivers_transporter_id ON drivers(transporter_id);
CREATE INDEX idx_drivers_mobile ON drivers(mobile);
CREATE INDEX idx_locations_customer_id ON locations(customer_id);
CREATE INDEX idx_locations_location_type ON locations(location_type);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_customer_id ON trips(customer_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX idx_trips_created_at ON trips(created_at);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_trip_id ON shipments(trip_id);
CREATE INDEX idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX idx_shipment_exceptions_shipment_id ON shipment_exceptions(shipment_id);
CREATE INDEX idx_shipment_exceptions_status ON shipment_exceptions(status);
CREATE INDEX idx_trip_alerts_trip_id ON trip_alerts(trip_id);
CREATE INDEX idx_trip_alerts_status ON trip_alerts(status);
CREATE INDEX idx_location_history_trip_id ON location_history(trip_id);
CREATE INDEX idx_location_history_event_time ON location_history(event_time);

-- =====================================================
-- SECTION 5: Create Functions
-- =====================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Role check function (replaces Supabase is_superadmin)
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Superadmin check function
CREATE OR REPLACE FUNCTION is_superadmin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = _user_id
          AND role = 'superadmin'
    )
$$;

-- Handle new user function (for application-level trigger simulation)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 6: Create Triggers
-- =====================================================

-- Updated at triggers for all tables
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transporters_updated_at BEFORE UPDATE ON transporters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicle_types_updated_at BEFORE UPDATE ON vehicle_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracking_assets_updated_at BEFORE UPDATE ON tracking_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_serviceability_lanes_updated_at BEFORE UPDATE ON serviceability_lanes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- New user trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON app_users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Phase 2: Create Target Database

### Step 2.1: AWS RDS Setup Script

```bash
#!/bin/bash
# setup-rds.sh

# Create RDS instance using AWS CLI
aws rds create-db-instance \
    --db-instance-identifier tms-production \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password "$RDS_PASSWORD" \
    --allocated-storage 100 \
    --storage-type gp3 \
    --vpc-security-group-ids sg-xxxxxxxx \
    --db-subnet-group-name tms-subnet-group \
    --backup-retention-period 7 \
    --multi-az \
    --storage-encrypted \
    --publicly-accessible false \
    --tags Key=Environment,Value=production Key=Application,Value=TMS

# Wait for instance to be available
aws rds wait db-instance-available --db-instance-identifier tms-production

echo "RDS instance created successfully"
```

### Step 2.2: Create Database and Extensions

```sql
-- Run on RDS as master user
-- connect-and-setup.sql

-- Create database
CREATE DATABASE tms_production;

-- Connect to tms_production and enable extensions
\c tms_production

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Create application user
CREATE USER tms_app WITH PASSWORD 'app-secure-password';
GRANT CONNECT ON DATABASE tms_production TO tms_app;
GRANT USAGE ON SCHEMA public TO tms_app;
```

---

## Phase 3: Schema Migration

### Step 3.1: Execute Schema on Target

```bash
#!/bin/bash
# migrate-schema.sh

echo "Applying schema to RDS..."

# Apply converted schema
psql "$RDS_URL" -f ./migration/schema/03_converted_schema.sql

if [ $? -eq 0 ]; then
    echo "Schema migration successful"
else
    echo "Schema migration failed!"
    exit 1
fi

# Grant permissions to application user
psql "$RDS_URL" << 'EOF'
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO tms_app;
EOF

echo "Permissions granted"
```

---

## Phase 4: Data Migration

### Step 4.1: User Data Migration Script

```bash
#!/bin/bash
# migrate-users.sh

echo "Migrating users from Supabase auth.users to app_users..."

psql "$SUPABASE_DB_URL" -t -A -c "
SELECT json_agg(row_to_json(u))
FROM (
    SELECT 
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new as email_change_token,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        phone,
        phone_confirmed_at,
        created_at,
        updated_at,
        banned_until,
        deleted_at
    FROM auth.users
) u;
" > ./migration/data/users.json

# Import to RDS using psql
python3 << 'EOF'
import json
import psycopg2
import os

# Load users
with open('./migration/data/users.json', 'r') as f:
    users = json.load(f)

if not users:
    print("No users to migrate")
    exit(0)

# Connect to RDS
conn = psycopg2.connect(os.environ['RDS_URL'])
cur = conn.cursor()

for user in users:
    cur.execute("""
        INSERT INTO app_users (
            id, email, encrypted_password, email_confirmed_at,
            invited_at, confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at, email_change_token,
            email_change, email_change_sent_at, last_sign_in_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin,
            phone, phone_confirmed_at, created_at, updated_at,
            banned_until, deleted_at
        ) VALUES (
            %(id)s, %(email)s, %(encrypted_password)s, %(email_confirmed_at)s,
            %(invited_at)s, %(confirmation_token)s, %(confirmation_sent_at)s,
            %(recovery_token)s, %(recovery_sent_at)s, %(email_change_token)s,
            %(email_change)s, %(email_change_sent_at)s, %(last_sign_in_at)s,
            %(raw_app_meta_data)s, %(raw_user_meta_data)s, %(is_super_admin)s,
            %(phone)s, %(phone_confirmed_at)s, %(created_at)s, %(updated_at)s,
            %(banned_until)s, %(deleted_at)s
        ) ON CONFLICT (id) DO NOTHING
    """, {
        **user,
        'raw_app_meta_data': json.dumps(user.get('raw_app_meta_data', {})),
        'raw_user_meta_data': json.dumps(user.get('raw_user_meta_data', {}))
    })

conn.commit()
cur.close()
conn.close()
print(f"Migrated {len(users)} users")
EOF
```

### Step 4.2: Full Data Migration Script

```bash
#!/bin/bash
# migrate-data.sh

TABLES=(
    "customers"
    "transporters"
    "vehicle_types"
    "tracking_assets"
    "vehicles"
    "drivers"
    "driver_documents"
    "locations"
    "serviceability_lanes"
    "lane_route_calculations"
    "materials"
    "driver_consents"
    "trips"
    "shipments"
    "trip_shipment_map"
    "trip_waypoints"
    "trip_alerts"
    "trip_audit_logs"
    "shipment_exceptions"
    "shipment_status_history"
    "tracking_logs"
    "location_history"
    "consent_logs"
    "integration_tokens"
    "tracking_settings"
    "profiles"
    "user_roles"
)

mkdir -p ./migration/data

for table in "${TABLES[@]}"; do
    echo "Exporting $table..."
    
    pg_dump "$SUPABASE_DB_URL" \
        --data-only \
        --table="public.$table" \
        --no-owner \
        --no-acl \
        --column-inserts \
        --file="./migration/data/${table}.sql"
done

echo "All tables exported"

# Import in dependency order
echo "Importing data to RDS..."

for table in "${TABLES[@]}"; do
    echo "Importing $table..."
    
    # Disable triggers during import
    psql "$RDS_URL" -c "ALTER TABLE $table DISABLE TRIGGER ALL;"
    
    psql "$RDS_URL" -f "./migration/data/${table}.sql"
    
    # Re-enable triggers
    psql "$RDS_URL" -c "ALTER TABLE $table ENABLE TRIGGER ALL;"
    
    if [ $? -ne 0 ]; then
        echo "Failed to import $table"
        exit 1
    fi
done

echo "Data migration complete"
```

### Step 4.3: Pgloader Configuration (Alternative)

```lisp
;; migration/pgloader.conf
;; High-performance data migration using pgloader

LOAD DATABASE
    FROM pgsql://postgres:password@supabase-host:6543/postgres
    INTO pgsql://postgres:password@rds-host:5432/tms_production

WITH include no drop,
     create no tables,
     create no indexes,
     reset sequences,
     workers = 4,
     concurrency = 2,
     batch rows = 10000,
     prefetch rows = 100000

SET work_mem to '256MB',
    maintenance_work_mem to '512MB'

EXCLUDING TABLE NAMES MATCHING 
    ~<schema_migrations>,
    'supabase_migrations'

CAST type uuid to uuid,
     type jsonb to jsonb,
     type timestamptz to timestamptz

BEFORE LOAD DO
$$ ALTER TABLE trips DISABLE TRIGGER ALL; $$,
$$ ALTER TABLE shipments DISABLE TRIGGER ALL; $$,
$$ ALTER TABLE location_history DISABLE TRIGGER ALL; $$

AFTER LOAD DO
$$ ALTER TABLE trips ENABLE TRIGGER ALL; $$,
$$ ALTER TABLE shipments ENABLE TRIGGER ALL; $$,
$$ ALTER TABLE location_history ENABLE TRIGGER ALL; $$,
$$ SELECT setval(pg_get_serial_sequence('trips', 'id'), COALESCE(MAX(id), 1)) FROM trips; $$
;
```

### Step 4.4: Storage Migration Script

```bash
#!/bin/bash
# migrate-storage.sh

# Download files from Supabase Storage
echo "Downloading files from Supabase Storage..."

BUCKETS=("driver-documents" "pod-documents")

for bucket in "${BUCKETS[@]}"; do
    mkdir -p "./migration/storage/$bucket"
    
    # List all files in bucket
    supabase storage ls "supabase://$bucket" --project-ref "$SUPABASE_PROJECT_REF" | while read file; do
        supabase storage cp "supabase://$bucket/$file" "./migration/storage/$bucket/$file" \
            --project-ref "$SUPABASE_PROJECT_REF"
    done
done

# Upload to S3
echo "Uploading files to S3..."

for bucket in "${BUCKETS[@]}"; do
    aws s3 sync "./migration/storage/$bucket" "s3://tms-storage-$bucket/" \
        --storage-class STANDARD_IA
done

echo "Storage migration complete"
```

---

## Phase 5: Post-Migration Validation

### Step 5.1: Row Count Validation

```bash
#!/bin/bash
# validate-counts.sh

TABLES=(
    "customers" "transporters" "vehicle_types" "tracking_assets"
    "vehicles" "drivers" "locations" "trips" "shipments"
    "profiles" "user_roles"
)

echo "Validating row counts..."
echo "-----------------------------------"
printf "%-30s %10s %10s %s\n" "TABLE" "SOURCE" "TARGET" "STATUS"
echo "-----------------------------------"

for table in "${TABLES[@]}"; do
    source_count=$(psql "$SUPABASE_DB_URL" -t -A -c "SELECT COUNT(*) FROM $table")
    target_count=$(psql "$RDS_URL" -t -A -c "SELECT COUNT(*) FROM $table")
    
    if [ "$source_count" -eq "$target_count" ]; then
        status="✓ MATCH"
    else
        status="✗ MISMATCH"
    fi
    
    printf "%-30s %10s %10s %s\n" "$table" "$source_count" "$target_count" "$status"
done
```

### Step 5.2: Data Integrity Validation

```sql
-- validation-queries.sql
-- Run these on both databases and compare results

-- Check trip-shipment relationships
SELECT 
    'trips_with_shipments' as check_name,
    COUNT(DISTINCT t.id) as trip_count,
    COUNT(tsm.id) as mapping_count
FROM trips t
LEFT JOIN trip_shipment_map tsm ON t.id = tsm.trip_id;

-- Check customer location counts
SELECT 
    c.id,
    c.display_name,
    COUNT(l.id) as location_count
FROM customers c
LEFT JOIN locations l ON c.id = l.customer_id
GROUP BY c.id, c.display_name
ORDER BY location_count DESC
LIMIT 10;

-- Check user roles distribution
SELECT 
    role,
    COUNT(*) as user_count
FROM user_roles
GROUP BY role;

-- Check foreign key integrity
SELECT 
    'orphan_shipments' as check_name,
    COUNT(*) as count
FROM shipments s
WHERE s.customer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = s.customer_id);

-- Check tracking data
SELECT 
    DATE(event_time) as date,
    COUNT(*) as location_points,
    COUNT(DISTINCT trip_id) as unique_trips
FROM location_history
GROUP BY DATE(event_time)
ORDER BY date DESC
LIMIT 7;
```

### Step 5.3: Sequence Reset Script

```sql
-- reset-sequences.sql
-- Reset all sequences to match migrated data

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            t.table_name,
            c.column_name,
            pg_get_serial_sequence(t.table_name, c.column_name) as seq
        FROM information_schema.tables t
        JOIN information_schema.columns c 
            ON t.table_name = c.table_name 
            AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public'
          AND c.column_default LIKE 'nextval%'
    ) LOOP
        IF r.seq IS NOT NULL THEN
            EXECUTE format(
                'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 1))',
                r.seq,
                r.column_name,
                r.table_name
            );
            RAISE NOTICE 'Reset sequence for %.%', r.table_name, r.column_name;
        END IF;
    END LOOP;
END $$;
```

---

## Rollback Procedures

### Rollback Script

```bash
#!/bin/bash
# rollback.sh

echo "Starting rollback procedure..."

# Option 1: Restore from backup
if [ -f "./backups/latest/full_backup.dump" ]; then
    echo "Restoring from backup..."
    pg_restore -d "$SUPABASE_DB_URL" \
        --clean \
        --if-exists \
        "./backups/latest/full_backup.dump"
fi

# Option 2: Point application back to Supabase
echo "Update application configuration to point back to Supabase"
echo "Update these environment variables:"
echo "  DATABASE_URL=$SUPABASE_DB_URL"
echo "  SUPABASE_URL=https://$SUPABASE_PROJECT_REF.supabase.co"

# Verify Supabase is still operational
psql "$SUPABASE_DB_URL" -c "SELECT 1 as health_check"

if [ $? -eq 0 ]; then
    echo "Supabase connection verified - rollback complete"
else
    echo "WARNING: Supabase connection failed!"
fi
```

---

## Migration Execution Checklist

```markdown
## Pre-Migration
- [ ] Backup Supabase database
- [ ] Test backup restoration
- [ ] Verify RDS instance is ready
- [ ] Test network connectivity to RDS
- [ ] Schedule maintenance window

## Schema Migration
- [ ] Export Supabase schema
- [ ] Convert schema (auth.users → app_users)
- [ ] Apply schema to RDS
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Verify all functions created

## Data Migration
- [ ] Export user data
- [ ] Export all table data
- [ ] Import users to app_users
- [ ] Import all table data
- [ ] Reset sequences
- [ ] Validate row counts
- [ ] Validate data integrity

## Storage Migration
- [ ] Download Supabase storage files
- [ ] Upload to S3
- [ ] Update file path references
- [ ] Verify file accessibility

## Application Updates
- [ ] Update database connection strings
- [ ] Update authentication to use new user table
- [ ] Deploy updated Edge Functions to Lambda
- [ ] Update storage references to S3
- [ ] Test all critical paths

## Post-Migration
- [ ] Monitor error rates
- [ ] Verify tracking functionality
- [ ] Verify user authentication
- [ ] Performance testing
- [ ] Update documentation
```

---

## Estimated Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Pre-migration prep | 2-3 days | Backups, testing, RDS setup |
| Schema migration | 1 day | Schema conversion and validation |
| Data migration | 4-8 hours | Depends on data volume |
| Application updates | 2-3 days | Code changes, testing |
| Validation & testing | 2-3 days | End-to-end testing |
| **Total** | **7-10 days** | With buffer for issues |

---

## Support & Troubleshooting

### Common Issues

1. **UUID generation fails**: Ensure `uuid-ossp` extension is enabled
2. **Enum type conflicts**: Drop and recreate enums in correct order
3. **Foreign key violations**: Import tables in dependency order
4. **Sequence out of sync**: Run sequence reset script after data import
5. **Permission denied**: Grant proper permissions to application user
