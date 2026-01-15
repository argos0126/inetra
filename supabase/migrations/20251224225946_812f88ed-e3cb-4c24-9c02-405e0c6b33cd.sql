-- Create alert type enum
CREATE TYPE trip_alert_type AS ENUM (
  'route_deviation',
  'stoppage',
  'idle_time',
  'tracking_lost',
  'consent_revoked',
  'geofence_entry',
  'geofence_exit',
  'speed_exceeded',
  'delay_warning'
);

-- Create alert status enum
CREATE TYPE alert_status AS ENUM (
  'active',
  'acknowledged',
  'resolved',
  'dismissed'
);

-- Create trip_alerts table
CREATE TABLE public.trip_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  alert_type trip_alert_type NOT NULL,
  status alert_status NOT NULL DEFAULT 'active',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text NOT NULL,
  triggered_at timestamp with time zone NOT NULL DEFAULT now(),
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid REFERENCES public.profiles(id),
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES public.profiles(id),
  location_latitude numeric,
  location_longitude numeric,
  threshold_value numeric,
  actual_value numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Superadmins can manage trip_alerts" 
ON public.trip_alerts 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_trip_alerts_updated_at
BEFORE UPDATE ON public.trip_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_trip_alerts_trip_id ON public.trip_alerts(trip_id);
CREATE INDEX idx_trip_alerts_status ON public.trip_alerts(status);
CREATE INDEX idx_trip_alerts_type ON public.trip_alerts(alert_type);
CREATE INDEX idx_trip_alerts_triggered_at ON public.trip_alerts(triggered_at DESC);

-- Add alert tracking columns to trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS active_alert_count integer DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS last_ping_at timestamp with time zone;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_trackable boolean DEFAULT true;