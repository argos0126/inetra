-- Add RLS policies for shipments table
CREATE POLICY "Users with shipments view can view shipments"
ON public.shipments
FOR SELECT
USING (has_permission(auth.uid(), 'shipments'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with shipments create can create shipments"
ON public.shipments
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'shipments'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with shipments update can update shipments"
ON public.shipments
FOR UPDATE
USING (has_permission(auth.uid(), 'shipments'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with shipments delete can delete shipments"
ON public.shipments
FOR DELETE
USING (has_permission(auth.uid(), 'shipments'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for trips table
CREATE POLICY "Users with trips view can view trips"
ON public.trips
FOR SELECT
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with trips create can create trips"
ON public.trips
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'trips'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with trips update can update trips"
ON public.trips
FOR UPDATE
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with trips delete can delete trips"
ON public.trips
FOR DELETE
USING (has_permission(auth.uid(), 'trips'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for shipment_exceptions table
CREATE POLICY "Users with exceptions view can view shipment_exceptions"
ON public.shipment_exceptions
FOR SELECT
USING (has_permission(auth.uid(), 'exceptions'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with exceptions create can create shipment_exceptions"
ON public.shipment_exceptions
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'exceptions'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with exceptions update can update shipment_exceptions"
ON public.shipment_exceptions
FOR UPDATE
USING (has_permission(auth.uid(), 'exceptions'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with exceptions delete can delete shipment_exceptions"
ON public.shipment_exceptions
FOR DELETE
USING (has_permission(auth.uid(), 'exceptions'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for trip_alerts table
CREATE POLICY "Users with alerts view can view trip_alerts"
ON public.trip_alerts
FOR SELECT
USING (has_permission(auth.uid(), 'alerts'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with alerts create can create trip_alerts"
ON public.trip_alerts
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'alerts'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with alerts update can update trip_alerts"
ON public.trip_alerts
FOR UPDATE
USING (has_permission(auth.uid(), 'alerts'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with alerts delete can delete trip_alerts"
ON public.trip_alerts
FOR DELETE
USING (has_permission(auth.uid(), 'alerts'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for driver_documents table
CREATE POLICY "Users with drivers view can view driver_documents"
ON public.driver_documents
FOR SELECT
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with drivers create can create driver_documents"
ON public.driver_documents
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'drivers'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with drivers update can update driver_documents"
ON public.driver_documents
FOR UPDATE
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with drivers delete can delete driver_documents"
ON public.driver_documents
FOR DELETE
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for vehicles table (currently only view for authenticated)
CREATE POLICY "Users with vehicles view can view vehicles"
ON public.vehicles
FOR SELECT
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with vehicles create can create vehicles"
ON public.vehicles
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'vehicles'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with vehicles update can update vehicles"
ON public.vehicles
FOR UPDATE
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with vehicles delete can delete vehicles"
ON public.vehicles
FOR DELETE
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for locations table
CREATE POLICY "Users with locations view can view locations"
ON public.locations
FOR SELECT
USING (has_permission(auth.uid(), 'locations'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with locations create can create locations"
ON public.locations
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'locations'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with locations update can update locations"
ON public.locations
FOR UPDATE
USING (has_permission(auth.uid(), 'locations'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with locations delete can delete locations"
ON public.locations
FOR DELETE
USING (has_permission(auth.uid(), 'locations'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for materials table
CREATE POLICY "Users with materials view can view materials"
ON public.materials
FOR SELECT
USING (has_permission(auth.uid(), 'materials'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with materials create can create materials"
ON public.materials
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'materials'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with materials update can update materials"
ON public.materials
FOR UPDATE
USING (has_permission(auth.uid(), 'materials'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with materials delete can delete materials"
ON public.materials
FOR DELETE
USING (has_permission(auth.uid(), 'materials'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for serviceability_lanes table
CREATE POLICY "Users with lanes view can view serviceability_lanes"
ON public.serviceability_lanes
FOR SELECT
USING (has_permission(auth.uid(), 'lanes'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with lanes create can create serviceability_lanes"
ON public.serviceability_lanes
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'lanes'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with lanes update can update serviceability_lanes"
ON public.serviceability_lanes
FOR UPDATE
USING (has_permission(auth.uid(), 'lanes'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with lanes delete can delete serviceability_lanes"
ON public.serviceability_lanes
FOR DELETE
USING (has_permission(auth.uid(), 'lanes'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for tracking_assets table
CREATE POLICY "Users with tracking_assets view can view tracking_assets"
ON public.tracking_assets
FOR SELECT
USING (has_permission(auth.uid(), 'tracking_assets'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with tracking_assets create can create tracking_assets"
ON public.tracking_assets
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'tracking_assets'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with tracking_assets update can update tracking_assets"
ON public.tracking_assets
FOR UPDATE
USING (has_permission(auth.uid(), 'tracking_assets'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with tracking_assets delete can delete tracking_assets"
ON public.tracking_assets
FOR DELETE
USING (has_permission(auth.uid(), 'tracking_assets'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for consent_logs table
CREATE POLICY "Users with consents view can view consent_logs"
ON public.consent_logs
FOR SELECT
USING (has_permission(auth.uid(), 'consents'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with consents create can create consent_logs"
ON public.consent_logs
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'consents'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with consents update can update consent_logs"
ON public.consent_logs
FOR UPDATE
USING (has_permission(auth.uid(), 'consents'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with consents delete can delete consent_logs"
ON public.consent_logs
FOR DELETE
USING (has_permission(auth.uid(), 'consents'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for vehicle_types table (using vehicles permission)
CREATE POLICY "Users with vehicles view can view vehicle_types"
ON public.vehicle_types
FOR SELECT
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with vehicles create can create vehicle_types"
ON public.vehicle_types
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'vehicles'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with vehicles update can update vehicle_types"
ON public.vehicle_types
FOR UPDATE
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with vehicles delete can delete vehicle_types"
ON public.vehicle_types
FOR DELETE
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'delete'::permission_action));

-- Add permission-based policies for lane_route_calculations
CREATE POLICY "Users with lanes view can view lane_route_calculations"
ON public.lane_route_calculations
FOR SELECT
USING (has_permission(auth.uid(), 'lanes'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with lanes create can create lane_route_calculations"
ON public.lane_route_calculations
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'lanes'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with lanes update can update lane_route_calculations"
ON public.lane_route_calculations
FOR UPDATE
USING (has_permission(auth.uid(), 'lanes'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with lanes delete can delete lane_route_calculations"
ON public.lane_route_calculations
FOR DELETE
USING (has_permission(auth.uid(), 'lanes'::permission_resource, 'delete'::permission_action));