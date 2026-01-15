-- =====================================================
-- TMS ENUM TYPES
-- =====================================================

-- Trip status lifecycle
CREATE TYPE trip_status AS ENUM (
  'created', 
  'ongoing', 
  'completed', 
  'cancelled', 
  'on_hold'
);

-- Shipment status lifecycle
CREATE TYPE shipment_status AS ENUM (
  'created', 
  'confirmed', 
  'in_pickup', 
  'in_transit', 
  'out_for_delivery', 
  'delivered', 
  'ndr', 
  'returned'
);

-- Tracking asset types
CREATE TYPE tracking_asset_type AS ENUM (
  'gps', 
  'sim', 
  'whatsapp', 
  'driver_app'
);

-- Location types
CREATE TYPE location_type AS ENUM (
  'node', 
  'consignee', 
  'plant', 
  'warehouse', 
  'distribution_center'
);

-- Freight types
CREATE TYPE freight_type AS ENUM (
  'ftl', 
  'ptl', 
  'express'
);

-- Serviceability modes
CREATE TYPE serviceability_mode AS ENUM (
  'surface', 
  'air', 
  'rail'
);

-- Consent status for tracking
CREATE TYPE consent_status AS ENUM (
  'not_requested', 
  'requested', 
  'granted', 
  'revoked', 
  'expired'
);

-- =====================================================
-- MASTER TABLES
-- =====================================================

-- Customers (Consignees)
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  gst_number TEXT,
  pan_number TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  integration_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage customers"
ON public.customers FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Transporters (Carriers)
CREATE TABLE public.transporters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transporter_name TEXT NOT NULL,
  code TEXT UNIQUE,
  email TEXT,
  mobile TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gstin TEXT,
  pan TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage transporters"
ON public.transporters FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_transporters_updated_at
BEFORE UPDATE ON public.transporters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vehicle Types
CREATE TABLE public.vehicle_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_name TEXT NOT NULL,
  length_cm NUMERIC,
  breadth_cm NUMERIC,
  height_cm NUMERIC,
  weight_capacity_kg NUMERIC,
  volume_capacity_cbm NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage vehicle_types"
ON public.vehicle_types FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_vehicle_types_updated_at
BEFORE UPDATE ON public.vehicle_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tracking Assets
CREATE TABLE public.tracking_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  asset_type tracking_asset_type NOT NULL,
  asset_id TEXT,
  api_url TEXT,
  api_token TEXT,
  response_json_mapping JSONB,
  transporter_id UUID REFERENCES public.transporters(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage tracking_assets"
ON public.tracking_assets FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_tracking_assets_updated_at
BEFORE UPDATE ON public.tracking_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vehicles
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_number TEXT NOT NULL UNIQUE,
  vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
  transporter_id UUID REFERENCES public.transporters(id) ON DELETE SET NULL,
  tracking_asset_id UUID REFERENCES public.tracking_assets(id) ON DELETE SET NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  is_dedicated BOOLEAN NOT NULL DEFAULT false,
  location_code TEXT,
  integration_code TEXT,
  -- Compliance documents
  rc_number TEXT,
  rc_issue_date DATE,
  rc_expiry_date DATE,
  puc_number TEXT,
  puc_issue_date DATE,
  puc_expiry_date DATE,
  insurance_number TEXT,
  insurance_issue_date DATE,
  insurance_expiry_date DATE,
  fitness_number TEXT,
  fitness_issue_date DATE,
  fitness_expiry_date DATE,
  permit_number TEXT,
  permit_issue_date DATE,
  permit_expiry_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage vehicles"
ON public.vehicles FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drivers
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  transporter_id UUID REFERENCES public.transporters(id) ON DELETE SET NULL,
  is_dedicated BOOLEAN NOT NULL DEFAULT false,
  location_code TEXT,
  license_number TEXT,
  license_issue_date DATE,
  license_expiry_date DATE,
  consent_status consent_status NOT NULL DEFAULT 'not_requested',
  -- Compliance documents
  aadhaar_number TEXT,
  aadhaar_verified BOOLEAN DEFAULT false,
  pan_number TEXT,
  pan_verified BOOLEAN DEFAULT false,
  voter_id TEXT,
  passport_number TEXT,
  police_verification_date DATE,
  police_verification_expiry DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage drivers"
ON public.drivers FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Locations
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_name TEXT NOT NULL,
  location_type location_type NOT NULL DEFAULT 'node',
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  district TEXT,
  zone TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  sim_radius_meters INTEGER DEFAULT 500,
  gps_radius_meters INTEGER DEFAULT 200,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  integration_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage locations"
ON public.locations FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_locations_updated_at
BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Serviceability Lanes
CREATE TABLE public.serviceability_lanes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lane_code TEXT NOT NULL UNIQUE,
  origin_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  destination_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  freight_type freight_type NOT NULL DEFAULT 'ftl',
  serviceability_mode serviceability_mode NOT NULL DEFAULT 'surface',
  transporter_id UUID REFERENCES public.transporters(id) ON DELETE SET NULL,
  vehicle_type_id UUID REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
  standard_tat_hours INTEGER,
  distance_km NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.serviceability_lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage serviceability_lanes"
ON public.serviceability_lanes FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_serviceability_lanes_updated_at
BEFORE UPDATE ON public.serviceability_lanes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Materials/SKU
CREATE TABLE public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku_code TEXT UNIQUE,
  description TEXT,
  packaging TEXT,
  units TEXT,
  is_bulk BOOLEAN NOT NULL DEFAULT false,
  length_cm NUMERIC,
  breadth_cm NUMERIC,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage materials"
ON public.materials FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_materials_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- TRANSACTIONAL TABLES
-- =====================================================

-- Trips
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_code TEXT NOT NULL UNIQUE,
  origin_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  destination_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  transporter_id UUID REFERENCES public.transporters(id) ON DELETE SET NULL,
  lane_id UUID REFERENCES public.serviceability_lanes(id) ON DELETE SET NULL,
  tracking_asset_id UUID REFERENCES public.tracking_assets(id) ON DELETE SET NULL,
  status trip_status NOT NULL DEFAULT 'created',
  planned_start_time TIMESTAMP WITH TIME ZONE,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  planned_end_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  planned_eta TIMESTAMP WITH TIME ZONE,
  current_eta TIMESTAMP WITH TIME ZONE,
  total_distance_km NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage trips"
ON public.trips FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_trips_updated_at
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Shipments
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_code TEXT NOT NULL UNIQUE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  pickup_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  drop_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity INTEGER,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  status shipment_status NOT NULL DEFAULT 'created',
  order_id TEXT,
  lr_number TEXT,
  waybill_number TEXT,
  pod_collected BOOLEAN NOT NULL DEFAULT false,
  pod_collected_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage shipments"
ON public.shipments FOR ALL
USING (is_superadmin(auth.uid()));

CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tracking Logs
CREATE TABLE public.tracking_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  tracking_asset_id UUID REFERENCES public.tracking_assets(id) ON DELETE SET NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  speed_kmph NUMERIC,
  accuracy_meters NUMERIC,
  heading NUMERIC,
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  source TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage tracking_logs"
ON public.tracking_logs FOR ALL
USING (is_superadmin(auth.uid()));

-- Index for efficient trip log queries
CREATE INDEX idx_tracking_logs_trip_id ON public.tracking_logs(trip_id);
CREATE INDEX idx_tracking_logs_event_time ON public.tracking_logs(event_time DESC);

-- Consent Logs
CREATE TABLE public.consent_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  status consent_status NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage consent_logs"
ON public.consent_logs FOR ALL
USING (is_superadmin(auth.uid()));

-- Trip Audit Log
CREATE TABLE public.trip_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  previous_status trip_status,
  new_status trip_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage trip_audit_logs"
ON public.trip_audit_logs FOR ALL
USING (is_superadmin(auth.uid()));

CREATE INDEX idx_trip_audit_logs_trip_id ON public.trip_audit_logs(trip_id);