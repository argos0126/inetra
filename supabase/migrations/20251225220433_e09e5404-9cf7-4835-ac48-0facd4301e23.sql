-- Materials: All authenticated users can view materials (shared data)
CREATE POLICY "Authenticated users can view materials"
ON public.materials
FOR SELECT
TO authenticated
USING (true);