-- Add RLS policies for shared/common data tables

-- Vehicle Types: All authenticated users can view
CREATE POLICY "Authenticated users can view vehicle_types"
ON public.vehicle_types
FOR SELECT
TO authenticated
USING (true);

-- Locations: All authenticated users can view all locations (shared data)
CREATE POLICY "Authenticated users can view locations"
ON public.locations
FOR SELECT
TO authenticated
USING (true);

-- Drivers: Authenticated users can view non-dedicated drivers OR drivers assigned to their transporter
CREATE POLICY "Authenticated users can view shared drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  is_dedicated = false 
  OR transporter_id IN (
    SELECT t.id FROM public.transporters t WHERE t.user_id = auth.uid()
  )
);