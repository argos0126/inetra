import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Save, AlertCircle, AlertTriangle, CheckCircle2, Loader2, Plus, Radio, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TripConsentSection } from "@/components/trip/TripConsentSection";

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
  license_expiry_date: string | null;
  aadhaar_verified: boolean | null;
  pan_verified: boolean | null;
}

interface Customer {
  id: string;
  display_name: string;
}

interface Transporter {
  id: string;
  transporter_name: string;
}

interface Lane {
  id: string;
  lane_code: string;
  distance_km: number | null;
  origin_location_id: string;
  destination_location_id: string;
}

interface ValidationWarning {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

export default function TripEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);

  // Validation state
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [vehicleOnTrip, setVehicleOnTrip] = useState<string | null>(null);
  const [driverOnTrip, setDriverOnTrip] = useState<string | null>(null);
  const [creatingLane, setCreatingLane] = useState(false);
  const [originalVehicleId, setOriginalVehicleId] = useState<string | null>(null);
  const [originalDriverId, setOriginalDriverId] = useState<string | null>(null);
  
  // Consent tracking state
  const [consentId, setConsentId] = useState<string | null>(null);
  const [existingSimConsentId, setExistingSimConsentId] = useState<string | null>(null);
  const [driversWithConsent, setDriversWithConsent] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    trip_code: "",
    origin_location_id: "",
    destination_location_id: "",
    vehicle_id: "",
    driver_id: "",
    customer_id: "",
    transporter_id: "",
    lane_id: "",
    status: "created",
    planned_start_time: "",
    planned_end_time: "",
    actual_start_time: "",
    actual_end_time: "",
    total_distance_km: "",
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    
    try {
      const [tripRes, locationsRes, vehiclesRes, driversRes, customersRes, transportersRes, lanesRes, consentsRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", id).single(),
        supabase.from("locations").select("id, location_name, latitude, longitude").eq("is_active", true).order("location_name"),
        supabase.from("vehicles").select("id, vehicle_number, tracking_asset_id, transporter_id, rc_expiry_date, insurance_expiry_date, permit_expiry_date, fitness_expiry_date, puc_expiry_date").eq("is_active", true).order("vehicle_number"),
        supabase.from("drivers").select("id, name, mobile, is_active, transporter_id, license_expiry_date, aadhaar_verified, pan_verified").eq("is_active", true).order("name"),
        supabase.from("customers").select("id, display_name").eq("is_active", true).order("display_name"),
        supabase.from("transporters").select("id, transporter_name").eq("is_active", true).order("transporter_name"),
        supabase.from("serviceability_lanes").select("id, lane_code, distance_km, origin_location_id, destination_location_id").eq("is_active", true).order("lane_code"),
        supabase.from("driver_consents").select("driver_id").eq("consent_status", "allowed")
      ]);

      if (tripRes.error) throw tripRes.error;

      const trip = tripRes.data;
      setOriginalVehicleId(trip.vehicle_id);
      setOriginalDriverId(trip.driver_id);
      setExistingSimConsentId(trip.sim_consent_id);
      if (trip.sim_consent_id) {
        setConsentId(trip.sim_consent_id);
      }
      
      setFormData({
        trip_code: trip.trip_code || "",
        origin_location_id: trip.origin_location_id || "",
        destination_location_id: trip.destination_location_id || "",
        vehicle_id: trip.vehicle_id || "",
        driver_id: trip.driver_id || "",
        customer_id: trip.customer_id || "",
        transporter_id: trip.transporter_id || "",
        lane_id: trip.lane_id || "",
        status: trip.status || "created",
        planned_start_time: trip.planned_start_time?.slice(0, 16) || "",
        planned_end_time: trip.planned_end_time?.slice(0, 16) || "",
        actual_start_time: trip.actual_start_time?.slice(0, 16) || "",
        actual_end_time: trip.actual_end_time?.slice(0, 16) || "",
        total_distance_km: trip.total_distance_km?.toString() || "",
        notes: trip.notes || ""
      });

      setLocations(locationsRes.data || []);
      setVehicles(vehiclesRes.data || []);
      setDrivers(driversRes.data || []);
      setCustomers(customersRes.data || []);
      setTransporters(transportersRes.data || []);
      setLanes(lanesRes.data || []);
      
      // Build set of driver IDs with active SIM consent
      const consentDriverIds = new Set(
        (consentsRes.data || []).map(c => c.driver_id)
      );
      setDriversWithConsent(consentDriverIds);
    } catch (error: any) {
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
      navigate("/trips");
    } finally {
      setLoading(false);
    }
  };

  // Check vehicle availability (exclude current trip)
  useEffect(() => {
    const checkVehicleAvailability = async () => {
      if (!formData.vehicle_id || formData.vehicle_id === originalVehicleId) {
        setVehicleOnTrip(null);
        return;
      }

      const { data } = await supabase
        .from("trips")
        .select("trip_code")
        .eq("vehicle_id", formData.vehicle_id)
        .in("status", ["created", "ongoing", "on_hold"])
        .neq("id", id)
        .limit(1)
        .maybeSingle();

      setVehicleOnTrip(data?.trip_code || null);
    };

    checkVehicleAvailability();
  }, [formData.vehicle_id, originalVehicleId, id]);

  // Check driver availability (exclude current trip)
  useEffect(() => {
    const checkDriverAvailability = async () => {
      if (!formData.driver_id || formData.driver_id === originalDriverId) {
        setDriverOnTrip(null);
        return;
      }

      const { data } = await supabase
        .from("trips")
        .select("trip_code")
        .eq("driver_id", formData.driver_id)
        .in("status", ["created", "ongoing", "on_hold"])
        .neq("id", id)
        .limit(1)
        .maybeSingle();

      setDriverOnTrip(data?.trip_code || null);
    };

    checkDriverAvailability();
  }, [formData.driver_id, originalDriverId, id]);

  // Check if trip is in an active state (ongoing or on_hold)
  const isActiveTrip = formData.status === 'ongoing' || formData.status === 'on_hold';

  // Comprehensive validation
  const validateForm = useMemo(() => {
    const warnings: ValidationWarning[] = [];
    const today = new Date().toISOString().split('T')[0];

    // For ongoing/on_hold trips, mandatory fields cannot be removed
    if (isActiveTrip) {
      if (!formData.origin_location_id) {
        warnings.push({
          type: 'error',
          field: 'origin',
          message: 'Origin location is required for ongoing trips'
        });
      }
      if (!formData.destination_location_id) {
        warnings.push({
          type: 'error',
          field: 'destination',
          message: 'Destination location is required for ongoing trips'
        });
      }
      if (!formData.vehicle_id) {
        warnings.push({
          type: 'error',
          field: 'vehicle',
          message: 'Vehicle is required for ongoing trips'
        });
      }
      if (!formData.driver_id) {
        warnings.push({
          type: 'error',
          field: 'driver',
          message: 'Driver is required for ongoing trips'
        });
      }
    }

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
        // Check vehicle availability (only if changed from original)
        if (vehicleOnTrip && formData.vehicle_id !== originalVehicleId) {
          warnings.push({
            type: 'error',
            field: 'vehicle',
            message: `Vehicle is already assigned to active trip: ${vehicleOnTrip}`
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
        // Check driver availability (only if changed from original)
        if (driverOnTrip && formData.driver_id !== originalDriverId) {
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

    setValidationWarnings(warnings);
    return warnings;
  }, [formData, vehicles, drivers, vehicleOnTrip, driverOnTrip, originalVehicleId, originalDriverId, isActiveTrip]);

  // Filter destination locations (exclude origin)
  const filteredDestinations = useMemo(() => {
    if (!formData.origin_location_id) return locations;
    return locations.filter(loc => loc.id !== formData.origin_location_id);
  }, [locations, formData.origin_location_id]);

  // Filter lanes based on selected origin/destination
  const filteredLanes = useMemo(() => {
    if (!formData.origin_location_id || !formData.destination_location_id) return lanes;
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
  
  const hasGpsTracker = selectedVehicle?.tracking_asset_id !== null && selectedVehicle?.tracking_asset_id !== undefined;
  const needsSimTracking = formData.vehicle_id && !hasGpsTracker && formData.driver_id;
  
  // Check if driver changed (needs new consent)
  const driverChanged = formData.driver_id && formData.driver_id !== originalDriverId;
  const needsNewConsent = needsSimTracking && (driverChanged || !existingSimConsentId);

  // Determine tracking type for database
  const computedTrackingType = useMemo(() => {
    if (!formData.vehicle_id) return 'none';
    if (hasGpsTracker) return 'gps';
    if (needsSimTracking && (consentId || existingSimConsentId)) return 'sim';
    return 'manual';
  }, [formData.vehicle_id, hasGpsTracker, needsSimTracking, consentId, existingSimConsentId]);

  // Handle consent ready callback
  const handleConsentReady = (newConsentId: string | null) => {
    setConsentId(newConsentId);
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

  const handleLaneChange = (laneId: string) => {
    const lane = lanes.find(l => l.id === laneId);
    setFormData({
      ...formData,
      lane_id: laneId === "__none__" ? "" : laneId,
      total_distance_km: lane?.distance_km?.toString() || formData.total_distance_km
    });
  };

  // Check if form can be submitted
  const hasBlockingErrors = validationWarnings.some(w => w.type === 'error');
  const simConsentMissing = needsNewConsent && !consentId;
  const errorWarnings = validationWarnings.filter(w => w.type === 'error');
  const warnWarnings = validationWarnings.filter(w => w.type === 'warning');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.trip_code.trim()) {
      toast({ title: "Error", description: "Trip code is required", variant: "destructive" });
      return;
    }

    if (hasBlockingErrors) {
      toast({ 
        title: "Cannot update trip", 
        description: "Please resolve all validation errors first",
        variant: "destructive" 
      });
      return;
    }

    // Check if SIM consent is required but not obtained
    if (simConsentMissing) {
      toast({ 
        title: "Consent Required", 
        description: "Please obtain driver consent for SIM tracking before updating the trip",
        variant: "destructive" 
      });
      return;
    }

    setSaving(true);
    try {
      // Re-validate vehicle/driver availability synchronously to prevent race conditions
      // Must exclude current trip from the check
      if (formData.vehicle_id) {
        const { data: vehicleTrip } = await supabase
          .from("trips")
          .select("trip_code")
          .eq("vehicle_id", formData.vehicle_id)
          .neq("id", id)
          .in("status", ["created", "ongoing", "on_hold"])
          .limit(1)
          .maybeSingle();
        
        if (vehicleTrip) {
          toast({ 
            title: "Vehicle Already Assigned", 
            description: `This vehicle is already assigned to trip ${vehicleTrip.trip_code}`,
            variant: "destructive" 
          });
          setSaving(false);
          return;
        }
      }

      if (formData.driver_id) {
        const { data: driverTrip } = await supabase
          .from("trips")
          .select("trip_code")
          .eq("driver_id", formData.driver_id)
          .neq("id", id)
          .in("status", ["created", "ongoing", "on_hold"])
          .limit(1)
          .maybeSingle();
        
        if (driverTrip) {
          toast({ 
            title: "Driver Already Assigned", 
            description: `This driver is already assigned to trip ${driverTrip.trip_code}`,
            variant: "destructive" 
          });
          setSaving(false);
          return;
        }
      }

      const trackingAssetId = selectedVehicle?.tracking_asset_id || null;
      const finalConsentId = consentId || existingSimConsentId;

      const { error } = await supabase.from("trips").update({
        trip_code: formData.trip_code.trim(),
        origin_location_id: formData.origin_location_id || null,
        destination_location_id: formData.destination_location_id || null,
        vehicle_id: formData.vehicle_id || null,
        driver_id: formData.driver_id || null,
        customer_id: formData.customer_id || null,
        transporter_id: formData.transporter_id || null,
        lane_id: formData.lane_id || null,
        status: formData.status as any,
        planned_start_time: formData.planned_start_time || null,
        planned_end_time: formData.planned_end_time || null,
        actual_start_time: formData.actual_start_time || null,
        actual_end_time: formData.actual_end_time || null,
        total_distance_km: formData.total_distance_km ? parseFloat(formData.total_distance_km) : null,
        notes: formData.notes || null,
        tracking_type: computedTrackingType,
        tracking_asset_id: trackingAssetId,
        sim_consent_id: needsSimTracking ? finalConsentId : null,
        is_trackable: computedTrackingType !== 'none' && computedTrackingType !== 'manual'
      }).eq("id", id);

      if (error) throw error;

      // Log driver/vehicle assignment changes to audit trail
      const driverChanged = formData.driver_id !== originalDriverId;
      const vehicleChanged = formData.vehicle_id !== originalVehicleId;
      
      if (driverChanged || vehicleChanged) {
        const previousDriver = drivers.find(d => d.id === originalDriverId);
        const newDriver = drivers.find(d => d.id === formData.driver_id);
        const previousVehicle = vehicles.find(v => v.id === originalVehicleId);
        const newVehicle = vehicles.find(v => v.id === formData.vehicle_id);
        
        const metadata: Record<string, any> = {};
        
        if (driverChanged) {
          metadata.driver_change = {
            previous_driver_id: originalDriverId,
            previous_driver_name: previousDriver?.name || null,
            new_driver_id: formData.driver_id || null,
            new_driver_name: newDriver?.name || null
          };
        }
        
        if (vehicleChanged) {
          metadata.vehicle_change = {
            previous_vehicle_id: originalVehicleId,
            previous_vehicle_number: previousVehicle?.vehicle_number || null,
            new_vehicle_id: formData.vehicle_id || null,
            new_vehicle_number: newVehicle?.vehicle_number || null
          };
        }
        
        await supabase.from("trip_audit_logs").insert({
          trip_id: id,
          previous_status: formData.status as any,
          new_status: formData.status as any,
          change_reason: driverChanged && vehicleChanged 
            ? 'Driver and vehicle assignment changed'
            : driverChanged 
              ? 'Driver assignment changed'
              : 'Vehicle assignment changed',
          metadata
        });
      }

      // Update driver_consents with trip_id if new consent was obtained
      if (needsSimTracking && consentId && consentId !== existingSimConsentId) {
        await supabase
          .from("driver_consents")
          .update({ trip_id: id })
          .eq("id", consentId);
      }

      toast({ title: "Success", description: "Trip updated successfully" });
      navigate(`/trips/${id}`);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Trip</h1>
            <p className="text-muted-foreground">Update trip information for {formData.trip_code}</p>
          </div>
        </div>

        {/* Validation Alerts */}
        {errorWarnings.length > 0 && (
          <Alert variant="destructive" className="w-full">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertTitle className="text-sm sm:text-base">Validation Errors</AlertTitle>
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

        {warnWarnings.length > 0 && (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 w-full">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200 text-sm sm:text-base">Warnings</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <ul className="mt-2 space-y-1 list-none pl-0">
                {warnWarnings.map((w, i) => (
                  <li key={i} className="text-xs sm:text-sm break-words leading-relaxed flex items-start gap-1">
                    <span className="flex-shrink-0">•</span>
                    <span className="break-words">{w.message}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {validationWarnings.length === 0 && formData.vehicle_id && formData.driver_id && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">All Validations Passed</AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              Vehicle and driver are compliant and available.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle>Trip Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trip_code">Trip Code *</Label>
                  <Input 
                    id="trip_code" 
                    value={formData.trip_code} 
                    onChange={(e) => setFormData({ ...formData, trip_code: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created">Created</SelectItem>
                      <SelectItem value="ongoing">Ongoing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer *</Label>
                  <Select 
                    value={formData.customer_id || "__none__"} 
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transporter_id">Transporter *</Label>
                  <Select 
                    value={formData.transporter_id || "__none__"} 
                    onValueChange={(value) => setFormData({ ...formData, transporter_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select transporter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {transporters.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.transporter_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Route Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origin_location_id">Origin Location *</Label>
                  <Select 
                    value={formData.origin_location_id || "__none__"} 
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      origin_location_id: value === "__none__" ? "" : value,
                      lane_id: "" // Reset lane when origin changes
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select origin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination_location_id">Destination Location *</Label>
                  <Select 
                    value={formData.destination_location_id || "__none__"} 
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      destination_location_id: value === "__none__" ? "" : value,
                      lane_id: "" // Reset lane when destination changes
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {filteredDestinations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lane_id">Lane</Label>
                  <div className="flex gap-2">
                    <Select 
                      value={formData.lane_id || "__none__"} 
                      onValueChange={handleLaneChange}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select lane" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {filteredLanes.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.lane_code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {noLaneAvailable && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleGenerateLane}
                        disabled={creatingLane}
                      >
                        {creatingLane ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  {noLaneAvailable && (
                    <p className="text-sm text-muted-foreground">
                      No lane exists for this route. Click + to create one.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_distance_km">Distance (km)</Label>
                  <Input 
                    id="total_distance_km" 
                    type="number" 
                    value={formData.total_distance_km} 
                    onChange={(e) => setFormData({ ...formData, total_distance_km: e.target.value })} 
                    placeholder="500"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Vehicle & Driver</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_id">Vehicle *</Label>
                    <Select 
                      value={formData.vehicle_id || "__none__"} 
                      onValueChange={(value) => {
                        setFormData({ ...formData, vehicle_id: value === "__none__" ? "" : value });
                        // Reset consent if vehicle changes
                        if (value !== formData.vehicle_id) {
                          setConsentId(null);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>{v.vehicle_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_id">Driver *</Label>
                    <Select 
                      value={formData.driver_id || "__none__"} 
                      onValueChange={(value) => {
                        setFormData({ ...formData, driver_id: value === "__none__" ? "" : value });
                        // Reset consent if driver changes
                        if (value !== formData.driver_id) {
                          setConsentId(null);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            <span className="flex items-center gap-2">
                              {d.name}
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
                  </div>
                </div>

                {/* Tracking Status & Consent Section */}
                {formData.vehicle_id && formData.driver_id && (
                  <div className="pt-4 border-t space-y-3">
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
                        {/* Show existing consent status if available and driver hasn't changed */}
                        {existingSimConsentId && !driverChanged ? (
                          <Alert className="border-green-500/50 bg-green-500/10">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4" />
                              <span>SIM consent already configured for this trip</span>
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <>
                            <Alert className="border-amber-500/50 bg-amber-500/10">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                              <AlertDescription className="flex items-center gap-2">
                                <Smartphone className="h-4 w-4" />
                                <span>
                                  {driverChanged 
                                    ? "Driver changed - new SIM consent required"
                                    : "No GPS on vehicle - SIM tracking will be used. Driver consent required."}
                                </span>
                              </AlertDescription>
                            </Alert>
                            
                            <TripConsentSection
                              driverId={formData.driver_id}
                              vehicleId={formData.vehicle_id}
                              drivers={drivers}
                              vehicles={vehicles}
                              onConsentReady={handleConsentReady}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="planned_start_time">Planned Start</Label>
                  <Input 
                    id="planned_start_time" 
                    type="datetime-local" 
                    value={formData.planned_start_time} 
                    onChange={(e) => setFormData({ ...formData, planned_start_time: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planned_end_time">Planned End</Label>
                  <Input 
                    id="planned_end_time" 
                    type="datetime-local" 
                    value={formData.planned_end_time} 
                    onChange={(e) => setFormData({ ...formData, planned_end_time: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual_start_time">Actual Start</Label>
                  <Input 
                    id="actual_start_time" 
                    type="datetime-local" 
                    value={formData.actual_start_time} 
                    onChange={(e) => setFormData({ ...formData, actual_start_time: e.target.value })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual_end_time">Actual End</Label>
                  <Input 
                    id="actual_end_time" 
                    type="datetime-local" 
                    value={formData.actual_end_time} 
                    onChange={(e) => setFormData({ ...formData, actual_end_time: e.target.value })} 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea 
                    id="notes" 
                    value={formData.notes} 
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                    placeholder="Additional trip notes..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/trips/${id}`)}>Cancel</Button>
              <Button type="submit" disabled={saving || hasBlockingErrors || simConsentMissing}>
                <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Update Trip"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}
