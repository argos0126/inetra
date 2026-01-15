import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, RefreshCw, Truck, User, MapPin, Route, Calendar, Radio, Smartphone, AlertCircle, CheckCircle2, Building2, Users, AlertTriangle, Loader2, Plus, XCircle, Package, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TripConsentSection } from "@/components/trip/TripConsentSection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { calculateHaversineDistance, formatDistance } from "@/utils/geoUtils";
import { checkUniqueTripCode } from "@/utils/validationUtils";
import { getDisplayErrorMessage, logError } from "@/utils/errorHandler";

// Default vehicle proximity radius in km (used if not configured in settings)
const DEFAULT_VEHICLE_PROXIMITY_RADIUS_KM = 50;

interface Location {
  id: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  tracking_asset_id: string | null;
  transporter_id: string | null;
  // KYC fields
  rc_expiry_date: string | null;
  insurance_expiry_date: string | null;
  permit_expiry_date: string | null;
  fitness_expiry_date: string | null;
  puc_expiry_date: string | null;
}

interface Driver {
  id: string;
  name: string;
  mobile: string;
  is_active: boolean;
  transporter_id: string | null;
  // KYC fields
  license_expiry_date: string | null;
  aadhaar_verified: boolean | null;
  pan_verified: boolean | null;
}

interface Lane {
  id: string;
  lane_code: string;
  distance_km: number | null;
  origin_location_id: string;
  destination_location_id: string;
}

interface Customer {
  id: string;
  display_name: string;
}

interface Transporter {
  id: string;
  transporter_name: string;
}

interface Shipment {
  id: string;
  shipment_code: string;
  pickup_location_id: string | null;
  drop_location_id: string | null;
  pickup_location?: { location_name: string } | null;
  drop_location?: { location_name: string } | null;
  customer_id: string | null;
  status: string;
  weight_kg: number | null;
  volume_cbm: number | null;
}

interface ValidationWarning {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

export default function TripAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [availableShipments, setAvailableShipments] = useState<Shipment[]>([]);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [shipmentSearch, setShipmentSearch] = useState("");
  
  // Validation state
  const [vehicleOnTrip, setVehicleOnTrip] = useState<string | null>(null);
  const [driverOnTrip, setDriverOnTrip] = useState<string | null>(null);
  const [creatingLane, setCreatingLane] = useState(false);
  
  // Vehicle proximity state
  const [vehicleLastLocation, setVehicleLastLocation] = useState<{
    latitude: number;
    longitude: number;
    event_time: string;
  } | null>(null);
  const [vehicleDistanceFromOrigin, setVehicleDistanceFromOrigin] = useState<number | null>(null);
  const [checkingVehicleLocation, setCheckingVehicleLocation] = useState(false);
  const [vehicleProximityRadiusMeters, setVehicleProximityRadiusMeters] = useState<number>(DEFAULT_VEHICLE_PROXIMITY_RADIUS_KM * 1000);
  
  // Consent tracking state
  const [consentId, setConsentId] = useState<string | null>(null);
  const [driversWithConsent, setDriversWithConsent] = useState<Set<string>>(new Set());
  const [currentTrackingType, setCurrentTrackingType] = useState<'gps' | 'sim' | null>(null);

  const generateTripCode = () => {
    const date = new Date();
    const prefix = "TRP";
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `${prefix}-${dateStr}-${random}`;
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    trip_code: generateTripCode(),
    origin_location_id: "",
    destination_location_id: "",
    lane_id: "",
    vehicle_id: "",
    driver_id: "",
    customer_id: "",
    transporter_id: "",
    consignee_name: "",
    planned_start_time: getCurrentDateTime(),
    total_distance_km: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [locationsRes, vehiclesRes, driversRes, lanesRes, customersRes, transportersRes, shipmentsRes, proximitySettingRes, consentsRes] = await Promise.all([
        supabase.from("locations").select("id, location_name, latitude, longitude").eq("is_active", true).order("location_name"),
        supabase.from("vehicles").select("id, vehicle_number, tracking_asset_id, transporter_id, rc_expiry_date, insurance_expiry_date, permit_expiry_date, fitness_expiry_date, puc_expiry_date").eq("is_active", true).order("vehicle_number"),
        supabase.from("drivers").select("id, name, mobile, is_active, transporter_id, license_expiry_date, aadhaar_verified, pan_verified").eq("is_active", true).order("name"),
        supabase.from("serviceability_lanes").select("id, lane_code, distance_km, origin_location_id, destination_location_id").eq("is_active", true).order("lane_code"),
        supabase.from("customers").select("id, display_name").eq("is_active", true).order("display_name"),
        supabase.from("transporters").select("id, transporter_name").eq("is_active", true).order("transporter_name"),
        supabase.from("shipments")
          .select("id, shipment_code, pickup_location_id, drop_location_id, customer_id, status, weight_kg, volume_cbm, pickup_location:locations!shipments_pickup_location_id_fkey(location_name), drop_location:locations!shipments_drop_location_id_fkey(location_name)")
          .is("trip_id", null)
          .in("status", ["created", "confirmed"])
          .order("created_at", { ascending: false }),
        supabase.from("tracking_settings").select("setting_value").eq("setting_key", "vehicle_proximity_radius_km").maybeSingle(),
        supabase.from("driver_consents").select("driver_id").eq("consent_status", "allowed")
      ]);

      setLocations(locationsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
      setLanes(lanesRes.data || []);
      setCustomers(customersRes.data || []);
      setTransporters(transportersRes.data || []);
      setAvailableShipments((shipmentsRes.data as unknown as Shipment[]) || []);
      
      // Set vehicle proximity radius from settings (convert km to meters)
      if (proximitySettingRes.data?.setting_value) {
        const radiusKm = parseFloat(proximitySettingRes.data.setting_value);
        if (!isNaN(radiusKm) && radiusKm > 0) {
          setVehicleProximityRadiusMeters(radiusKm * 1000);
        }
      }
      
      // Build set of driver IDs with active SIM consent
      const consentDriverIds = new Set(
        (consentsRes.data || []).map(c => c.driver_id)
      );
      setDriversWithConsent(consentDriverIds);
    } catch (error: any) {
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Check vehicle availability
  useEffect(() => {
    const checkVehicleAvailability = async () => {
      if (!formData.vehicle_id) {
        setVehicleOnTrip(null);
        return;
      }

      const { data } = await supabase
        .from("trips")
        .select("trip_code")
        .eq("vehicle_id", formData.vehicle_id)
        .in("status", ["created", "ongoing", "on_hold"])
        .limit(1)
        .maybeSingle();

      setVehicleOnTrip(data?.trip_code || null);
    };

    checkVehicleAvailability();
  }, [formData.vehicle_id]);

  // Check driver availability
  useEffect(() => {
    const checkDriverAvailability = async () => {
      if (!formData.driver_id) {
        setDriverOnTrip(null);
        return;
      }

      const { data } = await supabase
        .from("trips")
        .select("trip_code")
        .eq("driver_id", formData.driver_id)
        .in("status", ["created", "ongoing", "on_hold"])
        .limit(1)
        .maybeSingle();

      setDriverOnTrip(data?.trip_code || null);
    };

    checkDriverAvailability();
  }, [formData.driver_id]);

  // Check vehicle proximity to origin location
  useEffect(() => {
    const checkVehicleProximity = async () => {
      // Reset if no vehicle or origin selected
      if (!formData.vehicle_id || !formData.origin_location_id) {
        setVehicleLastLocation(null);
        setVehicleDistanceFromOrigin(null);
        return;
      }

      const origin = locations.find(l => l.id === formData.origin_location_id);
      if (!origin?.latitude || !origin?.longitude) {
        setVehicleDistanceFromOrigin(null);
        return;
      }

      setCheckingVehicleLocation(true);
      try {
        // Get vehicle's last known location from location_history
        const { data: locationData } = await supabase
          .from("location_history")
          .select("latitude, longitude, event_time")
          .eq("vehicle_id", formData.vehicle_id)
          .order("event_time", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (locationData) {
          setVehicleLastLocation({
            latitude: Number(locationData.latitude),
            longitude: Number(locationData.longitude),
            event_time: locationData.event_time
          });

          // Calculate distance from origin
          const distance = calculateHaversineDistance(
            Number(locationData.latitude),
            Number(locationData.longitude),
            Number(origin.latitude),
            Number(origin.longitude)
          );
          setVehicleDistanceFromOrigin(Math.round(distance));
        } else {
          setVehicleLastLocation(null);
          setVehicleDistanceFromOrigin(null);
        }
      } catch (error) {
        console.error("Error checking vehicle proximity:", error);
      } finally {
        setCheckingVehicleLocation(false);
      }
    };

    checkVehicleProximity();
  }, [formData.vehicle_id, formData.origin_location_id, locations]);

  // Comprehensive validation
  const computedWarnings = useMemo(() => {
    const warnings: ValidationWarning[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Origin/Destination validation
    if (formData.origin_location_id && formData.destination_location_id && 
        formData.origin_location_id === formData.destination_location_id) {
      warnings.push({
        type: 'error',
        field: 'route',
        message: 'Origin and destination cannot be the same location'
      });
    }

    // Vehicle validations
    if (formData.vehicle_id) {
      const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
      if (vehicle) {
        // Check vehicle availability
        if (vehicleOnTrip) {
          warnings.push({
            type: 'error',
            field: 'vehicle',
            message: `Vehicle is already assigned to active trip: ${vehicleOnTrip}`
          });
        }

        // Vehicle proximity check - block if too far from origin
        if (vehicleDistanceFromOrigin !== null && vehicleDistanceFromOrigin > vehicleProximityRadiusMeters) {
          warnings.push({
            type: 'error',
            field: 'vehicle',
            message: `Vehicle is ${formatDistance(vehicleDistanceFromOrigin)} away from origin. Must be within ${formatDistance(vehicleProximityRadiusMeters)}.`
          });
        } else if (vehicleLastLocation === null && formData.origin_location_id) {
          // No location history - just a warning, not blocking
          warnings.push({
            type: 'warning',
            field: 'vehicle',
            message: 'Vehicle has no GPS location history. Proximity cannot be verified.'
          });
        }

        // KYC checks
        if (vehicle.rc_expiry_date && vehicle.rc_expiry_date < today) {
          warnings.push({ type: 'error', field: 'vehicle', message: 'Vehicle RC has expired' });
        }
        if (vehicle.insurance_expiry_date && vehicle.insurance_expiry_date < today) {
          warnings.push({ type: 'error', field: 'vehicle', message: 'Vehicle insurance has expired' });
        }
        if (vehicle.permit_expiry_date && vehicle.permit_expiry_date < today) {
          warnings.push({ type: 'warning', field: 'vehicle', message: 'Vehicle permit has expired' });
        }
        if (vehicle.fitness_expiry_date && vehicle.fitness_expiry_date < today) {
          warnings.push({ type: 'warning', field: 'vehicle', message: 'Vehicle fitness certificate has expired' });
        }
        if (vehicle.puc_expiry_date && vehicle.puc_expiry_date < today) {
          warnings.push({ type: 'warning', field: 'vehicle', message: 'Vehicle PUC has expired' });
        }

        // Missing KYC documents
        if (!vehicle.rc_expiry_date) {
          warnings.push({ type: 'warning', field: 'vehicle', message: 'Vehicle RC details not uploaded' });
        }
        if (!vehicle.insurance_expiry_date) {
          warnings.push({ type: 'warning', field: 'vehicle', message: 'Vehicle insurance details not uploaded' });
        }
      }
    }

    // Driver validations
    if (formData.driver_id) {
      const driver = drivers.find(d => d.id === formData.driver_id);
      if (driver) {
        // Check driver availability
        if (driverOnTrip) {
          warnings.push({
            type: 'error',
            field: 'driver',
            message: `Driver is already assigned to active trip: ${driverOnTrip}`
          });
        }

        // KYC checks
        if (driver.license_expiry_date && driver.license_expiry_date < today) {
          warnings.push({ type: 'error', field: 'driver', message: 'Driver license has expired' });
        }
        if (!driver.license_expiry_date) {
          warnings.push({ type: 'warning', field: 'driver', message: 'Driver license details not uploaded' });
        }
        if (!driver.aadhaar_verified) {
          warnings.push({ type: 'warning', field: 'driver', message: 'Driver Aadhaar not verified' });
        }
      }
    }

    // Tracking validation
    if (formData.vehicle_id) {
      const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
      if (vehicle && !vehicle.tracking_asset_id && !formData.driver_id) {
        warnings.push({
          type: 'warning',
          field: 'tracking',
          message: 'No GPS tracker on vehicle. Select a driver for SIM tracking.'
        });
      }
    }

    return warnings;
  }, [formData, vehicles, drivers, vehicleOnTrip, driverOnTrip, vehicleDistanceFromOrigin, vehicleLastLocation, vehicleProximityRadiusMeters]);


  // Filter lanes based on selected origin/destination
  const filteredLanes = useMemo(() => {
    if (!formData.origin_location_id || !formData.destination_location_id) return [];
    return lanes.filter(
      l => l.origin_location_id === formData.origin_location_id && 
           l.destination_location_id === formData.destination_location_id
    );
  }, [lanes, formData.origin_location_id, formData.destination_location_id]);

  // Check if lane exists for selected route
  const noLaneAvailable = useMemo(() => {
    return formData.origin_location_id && 
           formData.destination_location_id && 
           formData.origin_location_id !== formData.destination_location_id &&
           filteredLanes.length === 0;
  }, [formData.origin_location_id, formData.destination_location_id, filteredLanes]);

  // Determine tracking method
  const selectedVehicle = useMemo(() => 
    vehicles.find(v => v.id === formData.vehicle_id), 
    [vehicles, formData.vehicle_id]
  );
  
  const hasGpsTracker = selectedVehicle?.tracking_asset_id !== null;
  const needsSimTracking = formData.vehicle_id && !hasGpsTracker && formData.driver_id;

  // Determine tracking type for database
  const computedTrackingType = useMemo(() => {
    if (!formData.vehicle_id) return 'none';
    if (hasGpsTracker) return 'gps';
    if (needsSimTracking && consentId) return 'sim';
    return 'manual';
  }, [formData.vehicle_id, hasGpsTracker, needsSimTracking, consentId]);

  // Filter shipments based on origin/destination compatibility and search
  const filteredShipments = useMemo(() => {
    let filtered = availableShipments;
    
    // Filter by route compatibility if origin/destination selected
    if (formData.origin_location_id && formData.destination_location_id) {
      filtered = filtered.filter(s => {
        // Compatible if pickup matches origin and drop matches destination
        const pickupCompatible = !s.pickup_location_id || s.pickup_location_id === formData.origin_location_id;
        const dropCompatible = !s.drop_location_id || s.drop_location_id === formData.destination_location_id;
        return pickupCompatible && dropCompatible;
      });
    }
    
    // Filter by customer if selected
    if (formData.customer_id) {
      filtered = filtered.filter(s => !s.customer_id || s.customer_id === formData.customer_id);
    }
    
    // Filter by search
    if (shipmentSearch.trim()) {
      const search = shipmentSearch.toLowerCase();
      filtered = filtered.filter(s => 
        s.shipment_code.toLowerCase().includes(search) ||
        s.pickup_location?.location_name?.toLowerCase().includes(search) ||
        s.drop_location?.location_name?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [availableShipments, formData.origin_location_id, formData.destination_location_id, formData.customer_id, shipmentSearch]);

  const handleShipmentToggle = (shipmentId: string) => {
    setSelectedShipmentIds(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    );
  };

  const handleConsentReady = (newConsentId: string | null, newTrackingType: 'gps' | 'sim' | null) => {
    setConsentId(newConsentId);
    setCurrentTrackingType(newTrackingType);
  };

  const regenerateTripCode = () => {
    setFormData({ ...formData, trip_code: generateTripCode() });
  };

  const handleLaneChange = (laneId: string) => {
    const lane = lanes.find(l => l.id === laneId);
    setFormData({
      ...formData,
      lane_id: laneId === "__none__" ? "" : laneId,
      total_distance_km: lane?.distance_km?.toString() || formData.total_distance_km
    });
  };

  // Generate lane for selected route
  const handleGenerateLane = async () => {
    if (!formData.origin_location_id || !formData.destination_location_id) return;

    const origin = locations.find(l => l.id === formData.origin_location_id);
    const destination = locations.find(l => l.id === formData.destination_location_id);

    if (!origin || !destination) return;

    setCreatingLane(true);
    try {
      const laneCode = `${origin.location_name.substring(0, 3).toUpperCase()}-${destination.location_name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      const { data: newLane, error } = await supabase
        .from("serviceability_lanes")
        .insert({
          lane_code: laneCode,
          origin_location_id: formData.origin_location_id,
          destination_location_id: formData.destination_location_id,
          is_active: true
        })
        .select("id, lane_code, distance_km, origin_location_id, destination_location_id")
        .single();

      if (error) throw error;

      // Add to lanes list and select it
      setLanes(prev => [...prev, newLane]);
      setFormData(prev => ({ ...prev, lane_id: newLane.id }));

      toast({
        title: "Lane Created",
        description: `Lane ${laneCode} has been created and selected`
      });
    } catch (error: any) {
      toast({
        title: "Error creating lane",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setCreatingLane(false);
    }
  };

  // Check if trip can be created
  const hasBlockingErrors = computedWarnings.some(w => w.type === 'error');

  const canCreateTrip = () => {
    if (!formData.trip_code.trim()) return false;
    if (!formData.origin_location_id || !formData.destination_location_id) return false;
    if (formData.origin_location_id === formData.destination_location_id) return false;
    if (!formData.vehicle_id) return false;
    if (!formData.driver_id) return false;
    if (!formData.customer_id) return false;
    if (!formData.transporter_id) return false;
    if (hasBlockingErrors) return false;
    if (needsSimTracking && !consentId) return false;
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canCreateTrip()) {
      toast({ 
        title: "Cannot create trip", 
        description: "Please resolve all errors and fill required fields",
        variant: "destructive" 
      });
      return;
    }

    if (needsSimTracking && !consentId) {
      toast({ 
        title: "Consent Required", 
        description: "Please obtain driver consent for SIM tracking before creating the trip", 
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);
    try {
      // Re-validate vehicle/driver availability synchronously to prevent race conditions
      if (formData.vehicle_id) {
        const { data: vehicleTrip } = await supabase
          .from("trips")
          .select("trip_code")
          .eq("vehicle_id", formData.vehicle_id)
          .in("status", ["created", "ongoing", "on_hold"])
          .limit(1)
          .maybeSingle();
        
        if (vehicleTrip) {
          toast({ 
            title: "Vehicle Already Assigned", 
            description: `This vehicle is already assigned to trip ${vehicleTrip.trip_code}`,
            variant: "destructive" 
          });
          setVehicleOnTrip(vehicleTrip.trip_code);
          setSaving(false);
          return;
        }
      }

      if (formData.driver_id) {
        const { data: driverTrip } = await supabase
          .from("trips")
          .select("trip_code")
          .eq("driver_id", formData.driver_id)
          .in("status", ["created", "ongoing", "on_hold"])
          .limit(1)
          .maybeSingle();
        
        if (driverTrip) {
          toast({ 
            title: "Driver Already Assigned", 
            description: `This driver is already assigned to trip ${driverTrip.trip_code}`,
            variant: "destructive" 
          });
          setDriverOnTrip(driverTrip.trip_code);
          setSaving(false);
          return;
        }
      }

      // Check for duplicate trip code
      const tripCodeUnique = await checkUniqueTripCode(formData.trip_code.trim());
      if (!tripCodeUnique) {
        toast({ 
          title: "Duplicate Trip Code", 
          description: "This trip code already exists. Please use a different code.", 
          variant: "destructive" 
        });
        setSaving(false);
        return;
      }

      const trackingAssetId = selectedVehicle?.tracking_asset_id || null;

      const { data: tripData, error: tripError } = await supabase.from("trips").insert({
        trip_code: formData.trip_code.trim(),
        origin_location_id: formData.origin_location_id,
        destination_location_id: formData.destination_location_id,
        vehicle_id: formData.vehicle_id,
        driver_id: formData.driver_id,
        customer_id: formData.customer_id,
        transporter_id: formData.transporter_id,
        consignee_name: formData.consignee_name || null,
        lane_id: formData.lane_id || null,
        status: "created",
        tracking_type: computedTrackingType,
        planned_start_time: formData.planned_start_time || null,
        total_distance_km: formData.total_distance_km ? parseFloat(formData.total_distance_km) : null,
        tracking_asset_id: trackingAssetId,
        sim_consent_id: needsSimTracking ? consentId : null,
        is_trackable: computedTrackingType !== 'none' && computedTrackingType !== 'manual'
      }).select('id').single();

      if (tripError) throw tripError;

      const tripId = tripData.id;

      // If lane is selected, auto-populate waypoints
      if (formData.lane_id) {
        const { data: routeData } = await supabase
          .from("lane_route_calculations")
          .select("waypoints")
          .eq("lane_id", formData.lane_id)
          .maybeSingle();

        if (routeData?.waypoints && Array.isArray(routeData.waypoints)) {
          const waypointsToInsert = routeData.waypoints.map((wp: any, index: number) => ({
            trip_id: tripId,
            waypoint_name: wp.name || `Waypoint ${index + 1}`,
            waypoint_type: wp.type === 'via' ? 'checkpoint' : 'stop',
            sequence_order: wp.sequence || index + 1,
            latitude: wp.lat,
            longitude: wp.lng,
            status: 'upcoming'
          }));

          if (waypointsToInsert.length > 0) {
            await supabase.from("trip_waypoints").insert(waypointsToInsert);
          }
        }
      }

      // Update driver_consents with trip_id if SIM tracking is used
      if (needsSimTracking && consentId) {
        await supabase
          .from("driver_consents")
          .update({ trip_id: tripId })
          .eq("id", consentId);
      }

      // Map selected shipments to the trip
      if (selectedShipmentIds.length > 0) {
        // Update shipments with trip_id and status
        await supabase
          .from("shipments")
          .update({ 
            trip_id: tripId, 
            status: "mapped",
            mapped_at: new Date().toISOString()
          })
          .in("id", selectedShipmentIds);
        
        // Create trip_shipment_map entries
        const mappings = selectedShipmentIds.map((shipmentId, index) => ({
          trip_id: tripId,
          shipment_id: shipmentId,
          sequence_order: index + 1
        }));
        await supabase.from("trip_shipment_map").insert(mappings);
      }

      const shipmentMsg = selectedShipmentIds.length > 0 ? ` with ${selectedShipmentIds.length} shipment(s)` : '';
      toast({ title: "Success", description: `Trip created successfully${shipmentMsg}` });
      navigate(`/trips/${tripId}`);
    } catch (error: any) {
      logError(error, "TripAdd");
      toast({ title: "Error", description: getDisplayErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Group warnings by field
  const errorWarnings = computedWarnings.filter(w => w.type === 'error');
  const warningWarnings = computedWarnings.filter(w => w.type === 'warning');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/trips")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Trip</h1>
            <p className="text-muted-foreground">Plan a new transportation trip</p>
          </div>
        </div>

        {/* Validation Errors & Warnings Summary */}
        {(errorWarnings.length > 0 || warningWarnings.length > 0) && (
          <div className="space-y-3 w-full overflow-hidden">
            {errorWarnings.length > 0 && (
              <Alert variant="destructive" className="w-full">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                <AlertTitle className="text-sm sm:text-base">Validation Errors ({errorWarnings.length})</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 list-none pl-0">
                    {errorWarnings.map((w, i) => (
                      <li key={i} className="text-xs sm:text-sm break-words leading-relaxed flex items-start gap-1">
                        <span className="flex-shrink-0">•</span>
                        <span className="break-words">{w.message}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {warningWarnings.length > 0 && (
              <Alert className="border-amber-500/50 bg-amber-500/10 w-full">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <AlertTitle className="text-amber-700 text-sm sm:text-base">Warnings ({warningWarnings.length})</AlertTitle>
                <AlertDescription className="text-amber-700">
                  <ul className="mt-2 space-y-1 list-none pl-0">
                    {warningWarnings.map((w, i) => (
                      <li key={i} className="text-xs sm:text-sm break-words leading-relaxed flex items-start gap-1">
                        <span className="flex-shrink-0">•</span>
                        <span className="break-words">{w.message}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Trip Code */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Route className="h-5 w-5" />
                Trip Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input 
                  value={formData.trip_code} 
                  onChange={(e) => setFormData({ ...formData, trip_code: e.target.value })} 
                  placeholder="Enter trip code"
                  className="flex-1"
                  required 
                />
                <Button type="button" variant="outline" size="icon" onClick={regenerateTripCode} title="Generate new code">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2. Customer & Transporter (Mandatory) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select 
                    value={formData.customer_id || "__none__"} 
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger className={!formData.customer_id ? "border-destructive/50" : ""}>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select customer</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transporter *</Label>
                  <Select 
                    value={formData.transporter_id || "__none__"} 
                    onValueChange={(value) => setFormData({ ...formData, transporter_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger className={!formData.transporter_id ? "border-destructive/50" : ""}>
                      <SelectValue placeholder="Select transporter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select transporter</SelectItem>
                      {transporters.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.transporter_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Consignee Name (Optional)</Label>
                <Input 
                  value={formData.consignee_name} 
                  onChange={(e) => setFormData({ ...formData, consignee_name: e.target.value })} 
                  placeholder="Enter consignee name"
                />
              </div>
            </CardContent>
          </Card>

          {/* 3. Origin & Destination */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Origin *</Label>
                  <Select 
                    value={formData.origin_location_id || "__none__"} 
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      origin_location_id: value === "__none__" ? "" : value, 
                      lane_id: "" 
                    })}
                  >
                    <SelectTrigger className={formData.origin_location_id === formData.destination_location_id && formData.origin_location_id ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select origin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select origin</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destination *</Label>
                  <Select 
                    value={formData.destination_location_id || "__none__"} 
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      destination_location_id: value === "__none__" ? "" : value, 
                      lane_id: "" 
                    })}
                  >
                    <SelectTrigger className={formData.origin_location_id === formData.destination_location_id && formData.destination_location_id ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select destination</SelectItem>
                      {locations.filter(l => l.id !== formData.origin_location_id).map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Same location error */}
              {formData.origin_location_id && formData.destination_location_id && 
               formData.origin_location_id === formData.destination_location_id && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>Origin and destination cannot be the same location</AlertDescription>
                </Alert>
              )}

              {/* Lane Code section */}
              {formData.origin_location_id && formData.destination_location_id && 
               formData.origin_location_id !== formData.destination_location_id && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Lane</Label>
                  {filteredLanes.length > 0 ? (
                    <Select 
                      value={formData.lane_id || "__none__"} 
                      onValueChange={handleLaneChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select lane" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No lane</SelectItem>
                        {filteredLanes.map((lane) => (
                          <SelectItem key={lane.id} value={lane.id}>
                            {lane.lane_code} {lane.distance_km && `(${lane.distance_km} km)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-muted-foreground flex-1">
                        No lanes configured for this route.
                      </p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handleGenerateLane}
                        disabled={creatingLane}
                      >
                        {creatingLane ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        Create Lane
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Vehicle & Driver */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehicle & Driver
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vehicle *</Label>
                  <Select 
                    value={formData.vehicle_id || "__none__"} 
                    onValueChange={(value) => setFormData({ ...formData, vehicle_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger className={vehicleOnTrip ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select vehicle</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="flex items-center gap-2">
                            {v.vehicle_number}
                            {v.tracking_asset_id && (
                              <Badge variant="secondary" className="text-xs">GPS</Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {vehicleOnTrip && (
                    <p className="text-xs text-destructive">Assigned to trip: {vehicleOnTrip}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Driver *</Label>
                  <Select 
                    value={formData.driver_id || "__none__"} 
                    onValueChange={(value) => setFormData({ ...formData, driver_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger className={driverOnTrip ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select driver</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="flex items-center gap-2">
                            {d.name} ({d.mobile})
                            {driversWithConsent.has(d.id) && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              >
                                SIM Consent
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {driverOnTrip && (
                    <p className="text-xs text-destructive">Assigned to trip: {driverOnTrip}</p>
                  )}
                </div>
              </div>

              {/* Tracking Status & Type Indicator */}
              {formData.vehicle_id && formData.driver_id && (
                <div className="pt-2 border-t space-y-3">
                  {/* Tracking Type Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Tracking Type:</span>
                    <Badge 
                      variant={computedTrackingType === 'gps' ? 'default' : computedTrackingType === 'sim' ? 'secondary' : 'outline'}
                      className={
                        computedTrackingType === 'gps' 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : computedTrackingType === 'sim' 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : ''
                      }
                    >
                      {computedTrackingType === 'gps' && <Radio className="h-3 w-3 mr-1" />}
                      {computedTrackingType === 'sim' && <Smartphone className="h-3 w-3 mr-1" />}
                      {computedTrackingType.toUpperCase()}
                    </Badge>
                  </div>

                  {hasGpsTracker ? (
                    <Alert className="border-green-500/50 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="flex items-center gap-2">
                        <Radio className="h-4 w-4" />
                        <span>Vehicle has GPS tracker - ready for tracking</span>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-3">
                      <Alert className="border-amber-500/50 bg-amber-500/10">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          <span>No GPS on vehicle - SIM tracking will be used. Driver consent required.</span>
                        </AlertDescription>
                      </Alert>
                      
                      <TripConsentSection
                        driverId={formData.driver_id}
                        vehicleId={formData.vehicle_id}
                        drivers={drivers}
                        vehicles={vehicles}
                        onConsentReady={handleConsentReady}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Planned Start */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Planned Start Time</Label>
                <Input 
                  type="datetime-local" 
                  value={formData.planned_start_time} 
                  onChange={(e) => setFormData({ ...formData, planned_start_time: e.target.value })} 
                />
                <p className="text-xs text-muted-foreground">Defaults to current time</p>
              </div>
            </CardContent>
          </Card>

          {/* 6. Shipments (Optional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Shipments
                {selectedShipmentIds.length > 0 && (
                  <Badge variant="secondary">{selectedShipmentIds.length} selected</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search shipments..."
                  value={shipmentSearch}
                  onChange={(e) => setShipmentSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {!formData.origin_location_id || !formData.destination_location_id ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Select origin and destination to see compatible shipments
                </p>
              ) : filteredShipments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No compatible shipments found. You can add shipments later from the trip details page.
                </p>
              ) : (
                <>
                  {/* Select All Header */}
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={filteredShipments.length > 0 && filteredShipments.every(s => selectedShipmentIds.includes(s.id))}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            const allIds = filteredShipments.map(s => s.id);
                            setSelectedShipmentIds(prev => [...new Set([...prev, ...allIds])]);
                          } else {
                            const filteredIds = filteredShipments.map(s => s.id);
                            setSelectedShipmentIds(prev => prev.filter(id => !filteredIds.includes(id)));
                          }
                        }}
                      />
                      <span className="text-sm font-medium">Select All ({filteredShipments.length})</span>
                    </div>
                    {selectedShipmentIds.length > 0 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedShipmentIds([])}
                        className="h-7 text-xs"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                  {filteredShipments.map((shipment) => (
                    <div 
                      key={shipment.id} 
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleShipmentToggle(shipment.id)}
                    >
                      <Checkbox
                        checked={selectedShipmentIds.includes(shipment.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => handleShipmentToggle(shipment.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{shipment.shipment_code}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {shipment.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {shipment.pickup_location?.location_name || 'N/A'} → {shipment.drop_location?.location_name || 'N/A'}
                        </p>
                      </div>
                      {(shipment.weight_kg || shipment.volume_cbm) && (
                        <div className="text-xs text-muted-foreground text-right shrink-0">
                          {shipment.weight_kg && <div>{shipment.weight_kg} kg</div>}
                          {shipment.volume_cbm && <div>{shipment.volume_cbm} cbm</div>}
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </>
              )}
              
              <p className="text-xs text-muted-foreground">
                Optional: Select shipments to map to this trip. You can also add shipments later.
              </p>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/trips")}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !canCreateTrip()}>
              {saving ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Creating...</span>
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Trip
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
