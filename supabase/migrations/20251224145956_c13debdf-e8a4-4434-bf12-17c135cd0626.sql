-- Create trip_waypoints table for storing waypoint events
CREATE TABLE public.trip_waypoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id),
  waypoint_name TEXT NOT NULL,
  waypoint_type TEXT NOT NULL DEFAULT 'stop', -- 'origin', 'stop', 'destination', 'checkpoint'
  sequence_order INTEGER NOT NULL DEFAULT 0,
  planned_arrival_time TIMESTAMP WITH TIME ZONE,
  planned_departure_time TIMESTAMP WITH TIME ZONE,
  actual_arrival_time TIMESTAMP WITH TIME ZONE,
  actual_departure_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'upcoming', -- 'completed', 'current', 'upcoming', 'skipped'
  delay_minutes INTEGER,
  notes TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_waypoints ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for superadmins
CREATE POLICY "Superadmins can manage trip_waypoints" 
ON public.trip_waypoints 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Create index for faster trip lookups
CREATE INDEX idx_trip_waypoints_trip_id ON public.trip_waypoints(trip_id);
CREATE INDEX idx_trip_waypoints_sequence ON public.trip_waypoints(trip_id, sequence_order);

-- Add trigger for updated_at
CREATE TRIGGER update_trip_waypoints_updated_at
BEFORE UPDATE ON public.trip_waypoints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();