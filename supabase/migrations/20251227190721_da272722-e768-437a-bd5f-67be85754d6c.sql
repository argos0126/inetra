-- Fix: Real-Time Location Data Exposed Across Competing Companies
-- Drop overly permissive RLS policies and replace with trip-scoped policies

-- Add indexes for RLS query performance
CREATE INDEX IF NOT EXISTS idx_trips_customer_id ON public.trips(customer_id);
CREATE INDEX IF NOT EXISTS idx_trips_transporter_id ON public.trips(transporter_id);

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users with trips view can view location_history" ON public.location_history;
DROP POLICY IF EXISTS "Users with trips view can view tracking_logs" ON public.tracking_logs;

-- Location history: Scoped to user's customer or transporter trips
CREATE POLICY "Users can view location_history for their trips"
ON public.location_history
FOR SELECT
USING (
  -- Superadmins see all
  is_superadmin(auth.uid())
  OR
  -- Users can only see location history for trips they own
  (
    has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action)
    AND trip_id IN (
      SELECT t.id FROM public.trips t
      WHERE 
        -- Customer's trips
        t.customer_id IN (
          SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()
        )
        OR
        -- Transporter's trips
        t.transporter_id IN (
          SELECT tr.id FROM public.transporters tr WHERE tr.user_id = auth.uid()
        )
    )
  )
);

-- Tracking logs: Same scoping
CREATE POLICY "Users can view tracking_logs for their trips"
ON public.tracking_logs
FOR SELECT
USING (
  is_superadmin(auth.uid())
  OR
  (
    has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action)
    AND trip_id IN (
      SELECT t.id FROM public.trips t
      WHERE 
        t.customer_id IN (
          SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()
        )
        OR
        t.transporter_id IN (
          SELECT tr.id FROM public.transporters tr WHERE tr.user_id = auth.uid()
        )
    )
  )
);