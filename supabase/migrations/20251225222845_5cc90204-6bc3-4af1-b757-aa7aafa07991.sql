-- =============================================
-- TnT Scope Completion Migration (Part 2)
-- Location types already added, now add consents to permission_resource
-- and create remaining RLS policies
-- =============================================

-- Add 'consents' to permission_resource enum
ALTER TYPE public.permission_resource ADD VALUE IF NOT EXISTS 'consents';

-- DRIVER_CONSENTS TABLE: Permission-based access (using 'drivers' as fallback since consents relates to drivers)
CREATE POLICY "Users with drivers view can view driver_consents"
ON public.driver_consents
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with drivers create can create driver_consents"
ON public.driver_consents
FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'drivers'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with drivers update can update driver_consents"
ON public.driver_consents
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with drivers delete can delete driver_consents"
ON public.driver_consents
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'delete'::permission_action));

-- RELATED TABLES: Trip waypoints, trip shipment map, tracking logs, location history
-- These should follow trip/shipment permissions

CREATE POLICY "Users with trips view can view trip_waypoints"
ON public.trip_waypoints
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with trips create can create trip_waypoints"
ON public.trip_waypoints
FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'trips'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with trips update can update trip_waypoints"
ON public.trip_waypoints
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with trips delete can delete trip_waypoints"
ON public.trip_waypoints
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'delete'::permission_action));

CREATE POLICY "Users with trips view can view trip_shipment_map"
ON public.trip_shipment_map
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with trips create can create trip_shipment_map"
ON public.trip_shipment_map
FOR INSERT
TO authenticated
WITH CHECK (has_permission(auth.uid(), 'trips'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with trips update can update trip_shipment_map"
ON public.trip_shipment_map
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with trips delete can delete trip_shipment_map"
ON public.trip_shipment_map
FOR DELETE
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'delete'::permission_action));

CREATE POLICY "Users with trips view can view trip_audit_logs"
ON public.trip_audit_logs
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with trips view can view tracking_logs"
ON public.tracking_logs
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with trips view can view location_history"
ON public.location_history
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with shipments view can view shipment_status_history"
ON public.shipment_status_history
FOR SELECT
TO authenticated
USING (has_permission(auth.uid(), 'shipments'::permission_resource, 'view'::permission_action));