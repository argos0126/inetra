-- Add 'success' to shipment_status enum
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'success';

-- Add new columns to shipments table for sub-status and timestamps
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS sub_status text,
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS mapped_at timestamptz,
ADD COLUMN IF NOT EXISTS in_pickup_at timestamptz,
ADD COLUMN IF NOT EXISTS loading_started_at timestamptz,
ADD COLUMN IF NOT EXISTS loading_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS in_transit_at timestamptz,
ADD COLUMN IF NOT EXISTS out_for_delivery_at timestamptz,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS ndr_at timestamptz,
ADD COLUMN IF NOT EXISTS returned_at timestamptz,
ADD COLUMN IF NOT EXISTS success_at timestamptz,
ADD COLUMN IF NOT EXISTS pod_cleaned_at timestamptz,
ADD COLUMN IF NOT EXISTS billed_at timestamptz,
ADD COLUMN IF NOT EXISTS paid_at timestamptz,
ADD COLUMN IF NOT EXISTS delay_percentage numeric,
ADD COLUMN IF NOT EXISTS is_delayed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS planned_pickup_time timestamptz,
ADD COLUMN IF NOT EXISTS planned_delivery_time timestamptz;

-- Create shipment_status_history table for tracking all status changes
CREATE TABLE IF NOT EXISTS shipment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  previous_sub_status text,
  new_sub_status text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  change_source text DEFAULT 'manual',
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on shipment_status_history
ALTER TABLE shipment_status_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for superadmins
CREATE POLICY "Superadmins can manage shipment_status_history" 
ON shipment_status_history 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Create index for faster queries on shipment_id
CREATE INDEX IF NOT EXISTS idx_shipment_status_history_shipment_id 
ON shipment_status_history(shipment_id);

-- Create index for changed_at for timeline queries
CREATE INDEX IF NOT EXISTS idx_shipment_status_history_changed_at 
ON shipment_status_history(changed_at DESC);