-- Tracking Assets: All authenticated users can view tracking assets (shared data)
CREATE POLICY "Authenticated users can view tracking_assets"
ON public.tracking_assets
FOR SELECT
TO authenticated
USING (true);