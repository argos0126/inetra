-- Create consent_status enum for driver consents if not exists
DO $$ BEGIN
  CREATE TYPE driver_consent_status AS ENUM ('pending', 'allowed', 'not_allowed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create tracking_source enum
DO $$ BEGIN
  CREATE TYPE tracking_source AS ENUM ('telenity', 'wheelseye', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create driver_consents table for SIM tracking consent management
CREATE TABLE IF NOT EXISTS public.driver_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  msisdn TEXT NOT NULL,
  consent_status driver_consent_status NOT NULL DEFAULT 'pending',
  consent_requested_at TIMESTAMP WITH TIME ZONE,
  consent_received_at TIMESTAMP WITH TIME ZONE,
  consent_expires_at TIMESTAMP WITH TIME ZONE,
  entity_id TEXT,
  telenity_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create location_history table for storing tracking data
CREATE TABLE IF NOT EXISTS public.location_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  tracking_asset_id UUID REFERENCES public.tracking_assets(id) ON DELETE SET NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy_meters NUMERIC,
  speed_kmph NUMERIC,
  heading NUMERIC,
  altitude_meters NUMERIC,
  source tracking_source NOT NULL DEFAULT 'manual',
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add tracking-related columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS sim_consent_id UUID REFERENCES public.driver_consents(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.driver_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for driver_consents
CREATE POLICY "Superadmins can manage driver_consents" 
ON public.driver_consents 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Create RLS policies for location_history
CREATE POLICY "Superadmins can manage location_history" 
ON public.location_history 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_consents_driver_id ON public.driver_consents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_consents_trip_id ON public.driver_consents(trip_id);
CREATE INDEX IF NOT EXISTS idx_driver_consents_status ON public.driver_consents(consent_status);
CREATE INDEX IF NOT EXISTS idx_location_history_trip_id ON public.location_history(trip_id);
CREATE INDEX IF NOT EXISTS idx_location_history_event_time ON public.location_history(event_time);
CREATE INDEX IF NOT EXISTS idx_location_history_source ON public.location_history(source);

-- Create trigger for updated_at on driver_consents
CREATE TRIGGER update_driver_consents_updated_at
BEFORE UPDATE ON public.driver_consents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for location_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_history;