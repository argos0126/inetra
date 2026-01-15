-- Step 1: Delete all existing tracking_logs data to start fresh
DELETE FROM public.tracking_logs;

-- Step 2: Drop existing columns that will be replaced
ALTER TABLE public.tracking_logs 
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS event_time,
  DROP COLUMN IF EXISTS detailed_address,
  DROP COLUMN IF EXISTS sequence_number,
  DROP COLUMN IF EXISTS heading,
  DROP COLUMN IF EXISTS speed_kmph,
  DROP COLUMN IF EXISTS accuracy_meters,
  DROP COLUMN IF EXISTS raw_data;

-- Step 3: Add new columns for JSON-based location storage
ALTER TABLE public.tracking_logs 
  ADD COLUMN raw_responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN location_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN last_sequence_number integer NOT NULL DEFAULT 0,
  ADD COLUMN last_updated_at timestamp with time zone DEFAULT now();

-- Step 4: Add unique constraint to ensure one row per trip
ALTER TABLE public.tracking_logs ADD CONSTRAINT tracking_logs_trip_unique UNIQUE (trip_id);

-- Step 5: Create index for faster trip lookups
CREATE INDEX IF NOT EXISTS idx_tracking_logs_trip_id ON public.tracking_logs(trip_id);