-- Create exception types enum
CREATE TYPE shipment_exception_type AS ENUM (
  'duplicate_mapping',
  'capacity_exceeded',
  'vehicle_not_arrived',
  'loading_discrepancy',
  'tracking_unavailable',
  'ndr_consignee_unavailable',
  'pod_rejected',
  'invoice_dispute',
  'delay_exceeded',
  'weight_mismatch',
  'other'
);

-- Create exception status enum
CREATE TYPE exception_status AS ENUM (
  'open',
  'acknowledged',
  'resolved',
  'escalated'
);

-- Create shipment_exceptions table
CREATE TABLE public.shipment_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  exception_type shipment_exception_type NOT NULL,
  status exception_status NOT NULL DEFAULT 'open',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description text NOT NULL,
  resolution_path text,
  resolution_notes text,
  detected_at timestamp with time zone NOT NULL DEFAULT now(),
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid REFERENCES public.profiles(id),
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES public.profiles(id),
  escalated_at timestamp with time zone,
  escalated_to text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipment_exceptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Superadmins can manage shipment_exceptions" 
ON public.shipment_exceptions 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_shipment_exceptions_updated_at
BEFORE UPDATE ON public.shipment_exceptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_shipment_exceptions_shipment_id ON public.shipment_exceptions(shipment_id);
CREATE INDEX idx_shipment_exceptions_status ON public.shipment_exceptions(status);
CREATE INDEX idx_shipment_exceptions_type ON public.shipment_exceptions(exception_type);
CREATE INDEX idx_shipment_exceptions_detected_at ON public.shipment_exceptions(detected_at DESC);

-- Add exception_count to shipments for quick filtering
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS exception_count integer DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS has_open_exception boolean DEFAULT false;