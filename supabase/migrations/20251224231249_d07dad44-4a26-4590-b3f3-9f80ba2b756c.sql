-- Phase 1: Add 'closed' status to trip_status enum and add new fields to trips table

-- Step 1: Add 'closed' to the trip_status enum
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'closed';

-- Step 2: Create tracking_type enum
DO $$ BEGIN
    CREATE TYPE tracking_type AS ENUM ('gps', 'sim', 'manual', 'none');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Add new columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS consignee_name text,
ADD COLUMN IF NOT EXISTS tracking_type tracking_type DEFAULT 'none',
ADD COLUMN IF NOT EXISTS closure_notes text,
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS closed_by uuid;

-- Step 4: Add composite unique index on shipments for uniqueness validation
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_unique_order 
ON public.shipments (pickup_location_id, drop_location_id, consignee_code, order_id) 
WHERE pickup_location_id IS NOT NULL 
  AND drop_location_id IS NOT NULL 
  AND consignee_code IS NOT NULL 
  AND order_id IS NOT NULL;