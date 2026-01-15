-- Serviceability Lanes: All authenticated users can view lanes (shared data)
CREATE POLICY "Authenticated users can view serviceability_lanes"
ON public.serviceability_lanes
FOR SELECT
TO authenticated
USING (true);

-- Lane Route Calculations: All authenticated users can view route calculations (shared data)
CREATE POLICY "Authenticated users can view lane_route_calculations"
ON public.lane_route_calculations
FOR SELECT
TO authenticated
USING (true);