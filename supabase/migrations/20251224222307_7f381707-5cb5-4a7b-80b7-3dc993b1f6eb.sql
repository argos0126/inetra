-- Add 'mapped' status to shipment_status enum
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'mapped' AFTER 'confirmed';

-- Add unique constraint for shipment combination
-- First, add consignee_code column if it doesn't exist
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS consignee_code TEXT;

-- Add shipment_type column to support different pick/drop patterns
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS shipment_type TEXT DEFAULT 'single_single' 
  CHECK (shipment_type IN ('single_single', 'single_multi', 'multi_single', 'multi_multi'));

-- Add dimensions columns
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS length_cm NUMERIC;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS breadth_cm NUMERIC;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS height_cm NUMERIC;

-- Create unique constraint for the combination (pickup, drop, consignee, order_id)
-- Using a partial unique index to handle nulls properly
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_unique_mapping 
ON public.shipments (pickup_location_id, drop_location_id, customer_id, order_id) 
WHERE pickup_location_id IS NOT NULL 
  AND drop_location_id IS NOT NULL 
  AND customer_id IS NOT NULL 
  AND order_id IS NOT NULL;

-- Create trip_shipment_map table for many-to-many relationship tracking
CREATE TABLE IF NOT EXISTS public.trip_shipment_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  mapped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mapped_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(trip_id, shipment_id)
);

-- Enable RLS
ALTER TABLE public.trip_shipment_map ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Superadmins can manage trip_shipment_map"
ON public.trip_shipment_map
FOR ALL
USING (is_superadmin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_trip_shipment_map_updated_at
BEFORE UPDATE ON public.trip_shipment_map
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trip_shipment_map_trip_id ON public.trip_shipment_map(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_shipment_map_shipment_id ON public.trip_shipment_map(shipment_id);