-- Create lane_routes table to store route waypoints and calculated route data
CREATE TABLE public.lane_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id UUID NOT NULL REFERENCES public.serviceability_lanes(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id),
  sequence_order INTEGER NOT NULL DEFAULT 0,
  waypoint_name TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  waypoint_type TEXT NOT NULL DEFAULT 'via', -- 'origin', 'via', 'destination'
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create lane_route_calculations table to store calculated route data
CREATE TABLE public.lane_route_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_id UUID NOT NULL UNIQUE REFERENCES public.serviceability_lanes(id) ON DELETE CASCADE,
  encoded_polyline TEXT,
  total_distance_meters INTEGER,
  total_duration_seconds INTEGER,
  route_summary TEXT,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lane_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lane_route_calculations ENABLE ROW LEVEL SECURITY;

-- Create policies for superadmins
CREATE POLICY "Superadmins can manage lane_routes" 
ON public.lane_routes 
FOR ALL 
USING (public.is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can manage lane_route_calculations" 
ON public.lane_route_calculations 
FOR ALL 
USING (public.is_superadmin(auth.uid()));

-- Create update triggers
CREATE TRIGGER update_lane_routes_updated_at
  BEFORE UPDATE ON public.lane_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lane_route_calculations_updated_at
  BEFORE UPDATE ON public.lane_route_calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_lane_routes_lane_id ON public.lane_routes(lane_id);
CREATE INDEX idx_lane_routes_sequence ON public.lane_routes(lane_id, sequence_order);
CREATE INDEX idx_lane_route_calculations_lane_id ON public.lane_route_calculations(lane_id);