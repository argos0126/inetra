-- Vehicles: All authenticated users can view vehicles (shared data)
CREATE POLICY "Authenticated users can view vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (true);