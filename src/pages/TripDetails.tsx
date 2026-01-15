import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Pause,
  MapPin,
  Route,
  Loader2,
  RefreshCw,
  FileCheck,
  FileX,
  Lock,
  Navigation
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TripExceptionsCard } from "@/components/trip/TripExceptionsCard";
import { LocationValidationDialog } from "@/components/trip/LocationValidationDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TripMapSection, MapWaypoint, TrackingPoint, TripAlertForMap } from "@/components/trip/TripMapSection";
import { TripOverviewCard } from "@/components/trip/TripOverviewCard";
import { LogisticsDetailsCard } from "@/components/trip/LogisticsDetailsCard";
import { TrackingStatusCard } from "@/components/trip/TrackingStatusCard";
import { TripTimeline, TimelineEvent } from "@/components/trip/TripTimeline";
import { TripTimelineEnhanced, EnhancedTimelineEvent } from "@/components/trip/TripTimelineEnhanced";
import { TripLiveTimeline, ShipmentStop, TripAlert as LiveTripAlert } from "@/components/trip/TripLiveTimeline";
import { TripETACard } from "@/components/trip/TripETACard";
import { TripAlerts, TripAlert } from "@/components/trip/TripAlerts";
import TripAlertsMonitor from "@/components/trip/TripAlertsMonitor";
import { ShipmentMapper } from "@/components/shipment/ShipmentMapper";
import { TripClosureDialog } from "@/components/trip/TripClosureDialog";
import { ShipmentPodUpload } from "@/components/shipment/ShipmentPodUpload";
import { clusterTrackingPoints, formatDuration } from "@/utils/trackingPointCluster";
import ManualLocationUpdateDialog from "@/components/alert/ManualLocationUpdateDialog";

interface Trip {
  id: string;
  trip_code: string;
  origin_location_id: string | null;
  destination_location_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  customer_id: string | null;
  transporter_id: string | null;
  lane_id: string | null;
  tracking_asset_id: string | null;
  tracking_type: string | null;
  sim_consent_id: string | null;
  status: string;
  planned_start_time: string | null;
  actual_start_time: string | null;
  planned_end_time: string | null;
  actual_end_time: string | null;
  planned_eta: string | null;
  current_eta: string | null;
  total_distance_km: number | null;
  notes: string | null;
  created_at: string;
  origin_location?: { id: string; location_name: string; city: string | null; latitude: number | null; longitude: number | null };
  destination_location?: { id: string; location_name: string; city: string | null; latitude: number | null; longitude: number | null };
  vehicle?: { id: string; vehicle_number: string; make: string | null; model: string | null; tracking_asset_id: string | null };
  driver?: { id: string; name: string; mobile: string };
  customer?: { id: string; display_name: string };
  transporter?: { id: string; transporter_name: string };
  tracking_asset?: { id: string; asset_type: string; asset_id: string | null };
  sim_consent?: { id: string; consent_status: string } | null;
}

interface Shipment {
  id: string;
  shipment_code: string;
  trip_id: string | null;
  customer_id: string | null;
  pickup_location_id: string | null;
  drop_location_id: string | null;
  material_id: string | null;
  quantity: number | null;
  weight_kg: number | null;
  volume_cbm: number | null;
  status: string;
  order_id: string | null;
  lr_number: string | null;
  waybill_number: string | null;
  pod_collected: boolean;
  pod_file_path: string | null;
  pod_file_name: string | null;
  notes: string | null;
  in_pickup_at: string | null;
  delivered_at: string | null;
  pickup_location?: { location_name: string };
  drop_location?: { location_name: string };
  material?: { name: string };
  customer?: { display_name: string };
}

interface Location {
  id: string;
  location_name: string;
}

interface Material {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  display_name: string;
}

interface TripWaypoint {
  id: string;
  trip_id: string;
  location_id: string | null;
  waypoint_name: string;
  waypoint_type: string;
  sequence_order: number;
  planned_arrival_time: string | null;
  planned_departure_time: string | null;
  actual_arrival_time: string | null;
  actual_departure_time: string | null;
  status: string;
  delay_minutes: number | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  location?: { location_name: string };
}

const shipmentStatusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  created: "outline",
  confirmed: "secondary",
  in_pickup: "secondary",
  in_transit: "secondary",
  out_for_delivery: "default",
  delivered: "default",
  ndr: "destructive",
  returned: "destructive"
};

export default function TripDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [waypoints, setWaypoints] = useState<TripWaypoint[]>([]);
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([]);
  const [tripAlerts, setTripAlerts] = useState<LiveTripAlert[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingTrip, setStartingTrip] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [isWaypointDialogOpen, setIsWaypointDialogOpen] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<TripWaypoint | null>(null);
  
  // Location validation state
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validationAction, setValidationAction] = useState<'start' | 'complete'>('start');
  const [validatingLocation, setValidatingLocation] = useState(false);
  
  // Trip closure state
  const [showClosureDialog, setShowClosureDialog] = useState(false);
  
  // Manual location update state
  const [showManualLocationDialog, setShowManualLocationDialog] = useState(false);
  // Lane waypoints and geofence state
  const [laneWaypoints, setLaneWaypoints] = useState<Array<{ name: string; sequence: number; lat: number; lng: number }>>([]);
  const [originGeofenceRadiusKm, setOriginGeofenceRadiusKm] = useState<number>(0.5);
  const [destinationGeofenceRadiusKm, setDestinationGeofenceRadiusKm] = useState<number>(0.5);

  // Calculate covered distance and progress from tracking points
  const { coveredDistanceKm, vehicleProgressPercent } = useMemo(() => {
    if (trackingPoints.length < 2) {
      return { coveredDistanceKm: 0, vehicleProgressPercent: 0 };
    }

    // Haversine formula to calculate distance between two points
    const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Calculate total covered distance from tracking points
    let totalCovered = 0;
    for (let i = 1; i < trackingPoints.length; i++) {
      const prev = trackingPoints[i - 1];
      const curr = trackingPoints[i];
      totalCovered += haversineDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }

    // Calculate progress percentage
    const totalDistance = trip?.total_distance_km || 0;
    let progress = 0;
    if (totalDistance > 0) {
      progress = Math.min(100, Math.round((totalCovered / totalDistance) * 100));
    } else if (totalCovered > 0) {
      // If no total distance set, estimate based on covered distance (assume 50% if we have any tracking)
      progress = Math.min(50, Math.round(totalCovered * 2));
    }

    return { 
      coveredDistanceKm: Math.round(totalCovered * 10) / 10, // Round to 1 decimal
      vehicleProgressPercent: progress 
    };
  }, [trackingPoints, trip?.total_distance_km]);

  // Real-time subscription for trip, shipments, waypoints, and location history
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`trip-details-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${id}` },
        () => fetchTrip()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments', filter: `trip_id=eq.${id}` },
        () => fetchShipments()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_waypoints', filter: `trip_id=eq.${id}` },
        () => fetchWaypoints()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'location_history', filter: `trip_id=eq.${id}` },
        () => fetchTrackingHistory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchTrip = async () => {
    if (!id) return;
    const { data, error } = await supabase.from("trips").select(`
      *,
      origin_location:locations!trips_origin_location_id_fkey(id, location_name, city, latitude, longitude),
      destination_location:locations!trips_destination_location_id_fkey(id, location_name, city, latitude, longitude),
      vehicle:vehicles(id, vehicle_number, make, model, tracking_asset_id),
      driver:drivers(id, name, mobile),
      customer:customers(id, display_name),
      transporter:transporters(id, transporter_name),
      tracking_asset:tracking_assets(id, asset_type, asset_id),
      sim_consent:driver_consents!trips_sim_consent_id_fkey(id, consent_status)
    `).eq("id", id).maybeSingle();
    if (!error && data) setTrip(data);
  };

  const fetchShipments = async () => {
    if (!id) return;
    const { data, error } = await supabase.from("shipments").select(`
      *,
      pickup_location:locations!shipments_pickup_location_id_fkey(location_name),
      drop_location:locations!shipments_drop_location_id_fkey(location_name),
      material:materials(name),
      customer:customers(display_name)
    `).eq("trip_id", id).order("created_at");
    if (!error && data) setShipments(data);
  };

  const fetchWaypoints = async () => {
    if (!id) return;
    const { data, error } = await supabase.from("trip_waypoints").select(`
      *,
      location:locations(location_name)
    `).eq("trip_id", id).order("sequence_order");
    if (!error && data) setWaypoints(data);
  };

  const fetchTrackingHistory = async () => {
    if (!id) return;
    // Query location_history with sampling for route display
    // Get every Nth point to limit to ~500 points for smooth rendering
    const { data: allData, error: countError } = await supabase
      .from("location_history")
      .select("id", { count: 'exact', head: true })
      .eq("trip_id", id);
    
    const totalCount = allData?.length || 0;
    const sampleInterval = Math.max(1, Math.floor(totalCount / 500)); // Max 500 points
    
    const { data, error } = await supabase
      .from("location_history")
      .select("id, latitude, longitude, event_time, raw_response, created_at")
      .eq("trip_id", id)
      .order("event_time", { ascending: true });
    
    if (!error && data) {
      // Sample points for display (every Nth point, always include first and last)
      const sampledPoints = data.filter((_, index) => 
        index === 0 || index === data.length - 1 || index % sampleInterval === 0
      );
      
      setTrackingPoints(sampledPoints.map((point, idx) => {
        const rawResponse = point.raw_response as { 
          address?: string; // Telenity format
          terminalLocation?: Array<{ currentLocation?: { detailedAddress?: string } }>; // Wheelseye format
        } | null;
        // Try Telenity format first (address), then Wheelseye format (terminalLocation)
        const address = rawResponse?.address || 
                       rawResponse?.terminalLocation?.[0]?.currentLocation?.detailedAddress || 
                       null;
        return {
          id: point.id,
          latitude: Number(point.latitude),
          longitude: Number(point.longitude),
          sequence_number: idx + 1,
          event_time: point.event_time,
          detailed_address: address
        };
      }));
    }
  };
  
  const [shipmentFormData, setShipmentFormData] = useState({
    shipment_code: "",
    customer_id: "",
    pickup_location_id: "",
    drop_location_id: "",
    material_id: "",
    quantity: "",
    weight_kg: "",
    volume_cbm: "",
    status: "created",
    order_id: "",
    lr_number: "",
    waybill_number: "",
    notes: ""
  });

  const [waypointFormData, setWaypointFormData] = useState({
    waypoint_name: "",
    waypoint_type: "stop",
    location_id: "",
    sequence_order: "0",
    planned_arrival_time: "",
    planned_departure_time: "",
    status: "upcoming",
    notes: ""
  });

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [tripRes, shipmentsRes, waypointsRes, trackingRes, alertsRes, locationsRes, materialsRes, customersRes] = await Promise.all([
        supabase.from("trips").select(`
          *,
          origin_location:locations!trips_origin_location_id_fkey(id, location_name, city, latitude, longitude),
          destination_location:locations!trips_destination_location_id_fkey(id, location_name, city, latitude, longitude),
          vehicle:vehicles(id, vehicle_number, make, model, tracking_asset_id),
          driver:drivers(id, name, mobile),
          customer:customers(id, display_name),
          transporter:transporters(id, transporter_name),
          tracking_asset:tracking_assets(id, asset_type, asset_id),
          sim_consent:driver_consents!trips_sim_consent_id_fkey(id, consent_status)
        `).eq("id", id).maybeSingle(),
        supabase.from("shipments").select(`
          *,
          pickup_location:locations!shipments_pickup_location_id_fkey(location_name),
          drop_location:locations!shipments_drop_location_id_fkey(location_name),
          material:materials(name),
          customer:customers(display_name)
        `).eq("trip_id", id).order("created_at", { ascending: false }),
        supabase.from("trip_waypoints").select(`
          *,
          location:locations(location_name)
        `).eq("trip_id", id).order("sequence_order"),
        supabase.from("location_history")
          .select("id, latitude, longitude, event_time, raw_response")
          .eq("trip_id", id)
          .order("event_time", { ascending: true }),
        supabase.from("trip_alerts")
          .select("id, alert_type, title, description, severity, status, triggered_at, location_latitude, location_longitude")
          .eq("trip_id", id)
          .in("status", ["active", "acknowledged"])
          .order("triggered_at", { ascending: false }),
        supabase.from("locations").select("id, location_name").eq("is_active", true),
        supabase.from("materials").select("id, name").eq("is_active", true),
        supabase.from("customers").select("id, display_name").eq("is_active", true)
      ]);

      if (tripRes.error) throw tripRes.error;
      if (shipmentsRes.error) throw shipmentsRes.error;

      setTrip(tripRes.data);
      setShipments(shipmentsRes.data || []);
      setWaypoints(waypointsRes.data || []);
      
      // Parse location_history from location_history table with sampling
      if (trackingRes.data && trackingRes.data.length > 0) {
        const allPoints = trackingRes.data;
        const sampleInterval = Math.max(1, Math.floor(allPoints.length / 500));
        const sampledPoints = allPoints.filter((_, index: number) => 
          index === 0 || index === allPoints.length - 1 || index % sampleInterval === 0
        );
        
        setTrackingPoints(sampledPoints.map((point: any, idx: number) => {
          const rawResponse = point.raw_response as { 
            address?: string; // Telenity format
            terminalLocation?: Array<{ currentLocation?: { detailedAddress?: string } }>; // Wheelseye format
          } | null;
          // Try Telenity format first (address), then Wheelseye format (terminalLocation)
          const address = rawResponse?.address || 
                         rawResponse?.terminalLocation?.[0]?.currentLocation?.detailedAddress || 
                         null;
          return {
            id: point.id,
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
            sequence_number: idx + 1,
            event_time: point.event_time,
            detailed_address: address
          };
        }));
      } else {
        setTrackingPoints([]);
      }
      setLocations(locationsRes.data || []);
      setMaterials(materialsRes.data || []);
      setCustomers(customersRes.data || []);
      setTripAlerts(alertsRes.data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching trip",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch lane waypoints and geofence settings when trip changes
  useEffect(() => {
    const fetchLaneWaypointsAndSettings = async () => {
      // Fetch geofence radius settings for origin and destination
      const { data: settingsData } = await supabase
        .from("tracking_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["origin_geofence_radius_km", "destination_geofence_radius_km"]);
      
      if (settingsData) {
        settingsData.forEach((setting) => {
          const value = parseFloat(setting.setting_value);
          if (setting.setting_key === "origin_geofence_radius_km" && !isNaN(value)) {
            setOriginGeofenceRadiusKm(value);
          } else if (setting.setting_key === "destination_geofence_radius_km" && !isNaN(value)) {
            setDestinationGeofenceRadiusKm(value);
          }
        });
      }

      // Fetch lane waypoints if trip has a lane
      if (trip?.lane_id) {
        const { data: routeData } = await supabase
          .from("lane_route_calculations")
          .select("waypoints")
          .eq("lane_id", trip.lane_id)
          .maybeSingle();
        
        if (routeData?.waypoints && Array.isArray(routeData.waypoints)) {
          setLaneWaypoints(routeData.waypoints.map((wp: any, idx: number) => ({
            name: wp.name || `Waypoint ${idx + 1}`,
            sequence: wp.sequence || idx + 1,
            lat: wp.lat,
            lng: wp.lng
          })));
        }
      }
    };

    fetchLaneWaypointsAndSettings();
  }, [trip?.lane_id]);

  // Auto-create stoppage alerts from tracking data
  const syncStoppageAlerts = useCallback(async () => {
    if (!id || trackingPoints.length < 2) return;
    
    // Cluster tracking points to detect stoppages (30 min threshold)
    const { clusters } = clusterTrackingPoints(trackingPoints, 100, 30);
    const stoppages = clusters.filter(c => c.isStoppage);
    
    if (stoppages.length === 0) return;

    // Get existing stoppage alerts for this trip to avoid duplicates
    const { data: existingAlerts } = await supabase
      .from("trip_alerts")
      .select("id, triggered_at, location_latitude, location_longitude")
      .eq("trip_id", id)
      .eq("alert_type", "stoppage");

    const existingAlertKeys = new Set(
      (existingAlerts || []).map(a => 
        `${new Date(a.triggered_at).getTime()}-${a.location_latitude?.toFixed(4)}-${a.location_longitude?.toFixed(4)}`
      )
    );

    // Create alerts for new stoppages
    const newAlerts = stoppages
      .filter(stoppage => {
        const key = `${stoppage.startTime.getTime()}-${stoppage.center.lat.toFixed(4)}-${stoppage.center.lng.toFixed(4)}`;
        return !existingAlertKeys.has(key);
      })
      .map(stoppage => ({
        trip_id: id,
        alert_type: "stoppage" as const,
        title: `Stoppage Detected (${formatDuration(stoppage.durationMinutes)})`,
        description: stoppage.address || `Vehicle stopped at ${stoppage.center.lat.toFixed(6)}, ${stoppage.center.lng.toFixed(6)}`,
        severity: stoppage.durationMinutes >= 60 ? "high" : "medium",
        status: "active" as const,
        triggered_at: stoppage.startTime.toISOString(),
        location_latitude: stoppage.center.lat,
        location_longitude: stoppage.center.lng,
        actual_value: stoppage.durationMinutes,
        threshold_value: 30,
        metadata: {
          point_count: stoppage.points.length,
          start_time: stoppage.startTime.toISOString(),
          end_time: stoppage.endTime.toISOString(),
        }
      }));

    if (newAlerts.length > 0) {
      const { error } = await supabase
        .from("trip_alerts")
        .insert(newAlerts);
      
      if (!error) {
        // Refresh alerts after creating new ones
        const { data: updatedAlerts } = await supabase
          .from("trip_alerts")
          .select("id, alert_type, title, description, severity, status, triggered_at, location_latitude, location_longitude")
          .eq("trip_id", id)
          .in("status", ["active", "acknowledged"])
          .order("triggered_at", { ascending: false });
        
        setTripAlerts(updatedAlerts || []);
      }
    }
  }, [id, trackingPoints]);

  // Run stoppage detection when tracking points change
  useEffect(() => {
    syncStoppageAlerts();
  }, [syncStoppageAlerts]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!trip) return;
    
    try {
      const updates: any = { status: newStatus };
      
      if (newStatus === "ongoing" && !trip.actual_start_time) {
        updates.actual_start_time = new Date().toISOString();
      }
      if (newStatus === "completed" && !trip.actual_end_time) {
        updates.actual_end_time = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from("trips")
        .update(updates)
        .eq("id", trip.id);
      
      if (error) throw error;
      
      // Auto-complete all shipments when trip is marked as completed
      if (newStatus === "completed" && shipments.length > 0) {
        const now = new Date().toISOString();
        const shipmentIds = shipments
          .filter(s => !['delivered', 'returned', 'success', 'ndr'].includes(s.status))
          .map(s => s.id);
        
        if (shipmentIds.length > 0) {
          const { error: shipmentError } = await supabase
            .from("shipments")
            .update({ 
              status: 'delivered',
              delivered_at: now
            })
            .in("id", shipmentIds);
          
          if (shipmentError) {
            console.error("Error auto-completing shipments:", shipmentError);
          } else {
            // Update local state
            setShipments(prev => prev.map(s => 
              shipmentIds.includes(s.id) 
                ? { ...s, status: 'delivered' } 
                : s
            ));
            toast({
              title: "Shipments auto-completed",
              description: `${shipmentIds.length} shipment(s) marked as delivered.`
            });
          }
        }
      }
      
      setTrip({ ...trip, ...updates });
      toast({
        title: "Status updated",
        description: `Trip status changed to ${newStatus}.`
      });
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Validate location before starting/completing trip
  const handleValidateLocation = async (action: 'start' | 'complete') => {
    if (!trip) return;
    
    setValidationAction(action);
    setValidatingLocation(true);
    setShowValidationDialog(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("start-trip/validate-location", {
        body: { tripId: trip.id, action }
      });

      if (error) throw error;

      setValidationResult(data);
    } catch (error: any) {
      setValidationResult({
        valid: false,
        distance_meters: 0,
        radius_meters: 500,
        current_location: null,
        target_location: { latitude: 0, longitude: 0, name: 'Unknown' },
        tracking_type: 'none',
        location_stale: false,
        error: error.message
      });
    } finally {
      setValidatingLocation(false);
    }
  };

  // Start trip with location tracking via edge function
  const handleStartTrip = async (skipValidation = false, overrideReason?: string) => {
    if (!trip) return;
    
    setStartingTrip(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-trip/start", {
        body: { 
          tripId: trip.id,
          skipValidation,
          overrideReason
        }
      });

      if (error) throw error;

      // Update local state with response
      setTrip({ 
        ...trip, 
        status: 'ongoing',
        actual_start_time: data.actualStartTime 
      });

      setShowValidationDialog(false);
      setValidationResult(null);

      toast({
        title: "Trip Started",
        description: data.validationOverridden 
          ? "Trip started with location override" 
          : data.initialLocation 
            ? `Trip started. Initial location tracked at ${data.initialLocation.detailedAddress || 'coordinates captured'}` 
            : data.message
      });

      // Refresh trip data and tracking history
      fetchTrip();
      fetchTrackingHistory();
    } catch (error: any) {
      toast({
        title: "Error starting trip",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setStartingTrip(false);
    }
  };

  // Complete trip with location validation
  const handleCompleteTrip = async (skipValidation = false, overrideReason?: string) => {
    if (!trip) return;
    
    setCompletingTrip(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-trip/complete", {
        body: { 
          tripId: trip.id,
          skipValidation,
          overrideReason
        }
      });

      if (error) throw error;

      setTrip({ 
        ...trip, 
        status: 'completed',
        actual_end_time: data.actualEndTime 
      });

      setShowValidationDialog(false);
      setValidationResult(null);

      toast({
        title: "Trip Completed",
        description: data.validationOverridden 
          ? "Trip completed with location override" 
          : "Trip has been completed successfully"
      });

      fetchTrip();
    } catch (error: any) {
      toast({
        title: "Error completing trip",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setCompletingTrip(false);
    }
  };

  // Handle validation dialog confirm
  const handleValidationConfirm = () => {
    if (validationAction === 'start') {
      handleStartTrip();
    } else {
      handleCompleteTrip();
    }
  };

  // Handle validation override
  const handleValidationOverride = (reason: string) => {
    if (validationAction === 'start') {
      handleStartTrip(true, reason);
    } else {
      handleCompleteTrip(true, reason);
    }
  };

  // Handle validation retry
  const handleValidationRetry = () => {
    handleValidateLocation(validationAction);
  };

  // Fetch location now (manual trigger)
  const handleFetchLocation = async () => {
    if (!trip) return;
    
    setFetchingLocation(true);
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `https://ofjgwusjzgjkfwumzwwy.supabase.co/functions/v1/start-trip/fetch-location?tripId=${trip.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch location');
      }

      const result = await response.json();

      toast({
        title: "Location Fetched",
        description: result.location?.detailedAddress 
          ? `Location updated: ${result.location.detailedAddress}` 
          : `Location updated (Seq: ${result.sequenceNumber})`
      });

      // Refresh tracking history
      fetchTrackingHistory();
    } catch (error: any) {
      toast({
        title: "Error fetching location",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleDelete = async () => {
    if (!trip) return;
    
    try {
      const { error } = await supabase
        .from("trips")
        .delete()
        .eq("id", trip.id);
      
      if (error) throw error;
      
      toast({
        title: "Trip deleted",
        description: `${trip.trip_code} has been deleted successfully.`
      });
      navigate("/trips");
    } catch (error: any) {
      toast({
        title: "Error deleting trip",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const generateShipmentCode = () => {
    const date = new Date();
    const prefix = "SHP";
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `${prefix}-${dateStr}-${random}`;
  };

  const handleAddShipment = () => {
    setEditingShipment(null);
    setShipmentFormData({
      shipment_code: generateShipmentCode(),
      customer_id: trip?.customer_id || "",
      pickup_location_id: trip?.origin_location_id || "",
      drop_location_id: trip?.destination_location_id || "",
      material_id: "",
      quantity: "",
      weight_kg: "",
      volume_cbm: "",
      status: "created",
      order_id: "",
      lr_number: "",
      waybill_number: "",
      notes: ""
    });
    setIsShipmentDialogOpen(true);
  };

  const handleEditShipment = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setShipmentFormData({
      shipment_code: shipment.shipment_code,
      customer_id: shipment.customer_id || "",
      pickup_location_id: shipment.pickup_location_id || "",
      drop_location_id: shipment.drop_location_id || "",
      material_id: shipment.material_id || "",
      quantity: shipment.quantity?.toString() || "",
      weight_kg: shipment.weight_kg?.toString() || "",
      volume_cbm: shipment.volume_cbm?.toString() || "",
      status: shipment.status,
      order_id: shipment.order_id || "",
      lr_number: shipment.lr_number || "",
      waybill_number: shipment.waybill_number || "",
      notes: shipment.notes || ""
    });
    setIsShipmentDialogOpen(true);
  };

  const handleDeleteShipment = async (shipment: Shipment) => {
    try {
      const { error } = await supabase
        .from("shipments")
        .delete()
        .eq("id", shipment.id);
      
      if (error) throw error;
      
      setShipments(shipments.filter(s => s.id !== shipment.id));
      toast({
        title: "Shipment deleted",
        description: `${shipment.shipment_code} has been removed.`
      });
    } catch (error: any) {
      toast({
        title: "Error deleting shipment",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handlePodToggle = async (shipmentId: string, collected: boolean) => {
    try {
      const { error } = await supabase
        .from("shipments")
        .update({ 
          pod_collected: collected,
          pod_collected_at: collected ? new Date().toISOString() : null
        })
        .eq("id", shipmentId);

      if (error) throw error;

      // Update local state
      setShipments(prev => prev.map(s => 
        s.id === shipmentId 
          ? { ...s, pod_collected: collected } 
          : s
      ));

      toast({
        title: collected ? "POD Collected" : "POD Marked Pending",
        description: collected 
          ? "Proof of delivery has been marked as collected." 
          : "POD status has been reset to pending."
      });
    } catch (error: any) {
      toast({
        title: "Error updating POD status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSubmitShipment = async () => {
    try {
      const shipmentCode = shipmentFormData.shipment_code.trim();
      
      // Validate shipment is not already mapped to another active trip
      const { data: existingShipment, error: checkError } = await supabase
        .from("shipments")
        .select(`
          id,
          shipment_code,
          trip_id,
          trips:trip_id (
            id,
            trip_code,
            status
          )
        `)
        .eq("shipment_code", shipmentCode)
        .neq("trip_id", trip?.id || '')
        .maybeSingle();

      if (checkError) throw checkError;

      // Check if shipment exists and is mapped to another active trip
      if (existingShipment && existingShipment.trip_id) {
        const tripData = existingShipment.trips as any;
        const activeStatuses = ['created', 'ongoing', 'on_hold'];
        
        if (tripData && activeStatuses.includes(tripData.status)) {
          toast({
            title: "Shipment Already Mapped",
            description: `Shipment ${shipmentCode} is already mapped to active trip ${tripData.trip_code}. Please unmap it first or use a different shipment.`,
            variant: "destructive"
          });
          return;
        }
      }

      const payload = {
        shipment_code: shipmentCode,
        trip_id: trip?.id,
        customer_id: shipmentFormData.customer_id || null,
        pickup_location_id: shipmentFormData.pickup_location_id || null,
        drop_location_id: shipmentFormData.drop_location_id || null,
        material_id: shipmentFormData.material_id || null,
        quantity: shipmentFormData.quantity ? parseInt(shipmentFormData.quantity) : null,
        weight_kg: shipmentFormData.weight_kg ? parseFloat(shipmentFormData.weight_kg) : null,
        volume_cbm: shipmentFormData.volume_cbm ? parseFloat(shipmentFormData.volume_cbm) : null,
        status: shipmentFormData.status as any,
        order_id: shipmentFormData.order_id.trim() || null,
        lr_number: shipmentFormData.lr_number.trim() || null,
        waybill_number: shipmentFormData.waybill_number.trim() || null,
        notes: shipmentFormData.notes.trim() || null
      };

      if (editingShipment) {
        const { error } = await supabase
          .from("shipments")
          .update(payload)
          .eq("id", editingShipment.id);
        
        if (error) throw error;
        
        toast({
          title: "Shipment updated",
          description: `${shipmentCode} has been updated.`
        });

        // Auto-complete trip when shipment is delivered (single shipment scenario)
        if (shipmentFormData.status === 'delivered' && trip?.status === 'ongoing') {
          await checkAndAutoCompleteTrip();
        }
      } else {
        const { error } = await supabase
          .from("shipments")
          .insert(payload);
        
        if (error) throw error;
        
        toast({
          title: "Shipment added",
          description: `${shipmentCode} has been added.`
        });
      }
      
      setIsShipmentDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error saving shipment",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Check if all shipments are delivered and auto-complete trip
  const checkAndAutoCompleteTrip = async () => {
    if (!trip || trip.status !== 'ongoing') return;

    try {
      // Fetch all shipments for this trip
      const { data: allShipments, error } = await supabase
        .from("shipments")
        .select("status")
        .eq("trip_id", trip.id);

      if (error) throw error;

      // If no shipments, don't auto-complete
      if (!allShipments || allShipments.length === 0) return;

      // Check if all shipments are delivered
      const allDelivered = allShipments.every(s => s.status === 'delivered');

      if (allDelivered) {
        // Auto-complete the trip
        const { data, error: completeError } = await supabase.functions.invoke("start-trip/complete", {
          body: { 
            tripId: trip.id,
            skipValidation: true,
            overrideReason: "Auto-completed: All shipments delivered"
          }
        });

        if (completeError) throw completeError;

        toast({
          title: "Trip Auto-Completed",
          description: "All shipments have been delivered. Trip marked as completed."
        });

        // Refresh trip data
        fetchTrip();
      }
    } catch (err: any) {
      console.error("Auto-complete check failed:", err.message);
      // Don't show error to user, this is a background check
    }
  };

  // Waypoint handlers
  const handleAddWaypoint = () => {
    setEditingWaypoint(null);
    const nextSequence = waypoints.length > 0 
      ? Math.max(...waypoints.map(w => w.sequence_order)) + 1 
      : 1;
    setWaypointFormData({
      waypoint_name: "",
      waypoint_type: "stop",
      location_id: "",
      sequence_order: nextSequence.toString(),
      planned_arrival_time: "",
      planned_departure_time: "",
      status: "upcoming",
      notes: ""
    });
    setIsWaypointDialogOpen(true);
  };

  const handleEditWaypoint = (waypoint: TripWaypoint) => {
    setEditingWaypoint(waypoint);
    setWaypointFormData({
      waypoint_name: waypoint.waypoint_name,
      waypoint_type: waypoint.waypoint_type,
      location_id: waypoint.location_id || "",
      sequence_order: waypoint.sequence_order.toString(),
      planned_arrival_time: waypoint.planned_arrival_time 
        ? new Date(waypoint.planned_arrival_time).toISOString().slice(0, 16) 
        : "",
      planned_departure_time: waypoint.planned_departure_time 
        ? new Date(waypoint.planned_departure_time).toISOString().slice(0, 16) 
        : "",
      status: waypoint.status,
      notes: waypoint.notes || ""
    });
    setIsWaypointDialogOpen(true);
  };

  const handleDeleteWaypoint = async (waypoint: TripWaypoint) => {
    try {
      const { error } = await supabase
        .from("trip_waypoints")
        .delete()
        .eq("id", waypoint.id);
      
      if (error) throw error;
      
      setWaypoints(waypoints.filter(w => w.id !== waypoint.id));
      toast({
        title: "Waypoint deleted",
        description: `${waypoint.waypoint_name} has been removed.`
      });
    } catch (error: any) {
      toast({
        title: "Error deleting waypoint",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSubmitWaypoint = async () => {
    if (!waypointFormData.waypoint_name.trim()) {
      toast({
        title: "Validation error",
        description: "Waypoint name is required.",
        variant: "destructive"
      });
      return;
    }

    try {
      const payload = {
        trip_id: trip?.id,
        waypoint_name: waypointFormData.waypoint_name.trim(),
        waypoint_type: waypointFormData.waypoint_type,
        location_id: waypointFormData.location_id || null,
        sequence_order: parseInt(waypointFormData.sequence_order) || 0,
        planned_arrival_time: waypointFormData.planned_arrival_time || null,
        planned_departure_time: waypointFormData.planned_departure_time || null,
        status: waypointFormData.status,
        notes: waypointFormData.notes.trim() || null
      };

      if (editingWaypoint) {
        const { error } = await supabase
          .from("trip_waypoints")
          .update(payload)
          .eq("id", editingWaypoint.id);
        
        if (error) throw error;
        
        toast({
          title: "Waypoint updated",
          description: `${waypointFormData.waypoint_name} has been updated.`
        });
      } else {
        const { error } = await supabase
          .from("trip_waypoints")
          .insert(payload);
        
        if (error) throw error;
        
        toast({
          title: "Waypoint added",
          description: `${waypointFormData.waypoint_name} has been added.`
        });
      }
      
      setIsWaypointDialogOpen(false);
      fetchWaypoints();
    } catch (error: any) {
      toast({
        title: "Error saving waypoint",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Populate waypoints from lane route calculation
  const handlePopulateWaypoints = async () => {
    if (!trip?.lane_id) return;
    
    try {
      const { data: routeData, error: routeError } = await supabase
        .from("lane_route_calculations")
        .select("waypoints")
        .eq("lane_id", trip.lane_id)
        .maybeSingle();

      if (routeError) throw routeError;
      
      if (!routeData?.waypoints || !Array.isArray(routeData.waypoints)) {
        toast({
          title: "No waypoints found",
          description: "This lane doesn't have calculated waypoints yet.",
          variant: "destructive"
        });
        return;
      }

      const waypointsToInsert = routeData.waypoints.map((wp: any, index: number) => ({
        trip_id: trip.id,
        waypoint_name: wp.name || `Waypoint ${index + 1}`,
        waypoint_type: wp.type === 'via' ? 'checkpoint' : 'stop',
        sequence_order: wp.sequence || index + 1,
        latitude: wp.lat,
        longitude: wp.lng,
        status: 'upcoming'
      }));

      const { error: insertError } = await supabase
        .from("trip_waypoints")
        .insert(waypointsToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Waypoints loaded",
        description: `${waypointsToInsert.length} waypoints added from lane route.`
      });
      
      fetchWaypoints();
    } catch (error: any) {
      toast({
        title: "Error loading waypoints",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Build shipment stops for timeline (pickups and drops), grouped by location
  const getShipmentStops = (): ShipmentStop[] => {
    // Group pickups by location
    const pickupsByLocation: Record<string, { locationName: string; shipments: typeof shipments; completedCount: number; latestTime?: string }> = {};
    const dropsByLocation: Record<string, { locationName: string; shipments: typeof shipments; completedCount: number; latestTime?: string }> = {};
    
    shipments.forEach(shipment => {
      // Group pickups
      if (shipment.pickup_location && shipment.pickup_location_id) {
        const locId = shipment.pickup_location_id;
        if (!pickupsByLocation[locId]) {
          pickupsByLocation[locId] = {
            locationName: shipment.pickup_location.location_name,
            shipments: [],
            completedCount: 0
          };
        }
        pickupsByLocation[locId].shipments.push(shipment);
        if (["in_transit", "out_for_delivery", "delivered", "success"].includes(shipment.status)) {
          pickupsByLocation[locId].completedCount++;
        }
        if (shipment.in_pickup_at && (!pickupsByLocation[locId].latestTime || shipment.in_pickup_at > pickupsByLocation[locId].latestTime!)) {
          pickupsByLocation[locId].latestTime = shipment.in_pickup_at;
        }
      }
      
      // Group drops
      if (shipment.drop_location && shipment.drop_location_id) {
        const locId = shipment.drop_location_id;
        if (!dropsByLocation[locId]) {
          dropsByLocation[locId] = {
            locationName: shipment.drop_location.location_name,
            shipments: [],
            completedCount: 0
          };
        }
        dropsByLocation[locId].shipments.push(shipment);
        if (["delivered", "success"].includes(shipment.status)) {
          dropsByLocation[locId].completedCount++;
        }
        if (shipment.delivered_at && (!dropsByLocation[locId].latestTime || shipment.delivered_at > dropsByLocation[locId].latestTime!)) {
          dropsByLocation[locId].latestTime = shipment.delivered_at;
        }
      }
    });
    
    const stops: ShipmentStop[] = [];
    
    // Create grouped pickup stops
    Object.entries(pickupsByLocation).forEach(([locId, data]) => {
      const allCompleted = data.completedCount === data.shipments.length;
      const shipmentCodes = data.shipments.map(s => s.shipment_code).join(", ");
      stops.push({
        id: `pickup-${locId}`,
        type: "pickup",
        location_name: data.shipments.length > 1 
          ? `${data.locationName} (${data.shipments.length} pickups)`
          : data.locationName,
        shipment_code: data.shipments.length > 1 
          ? `${data.completedCount}/${data.shipments.length} completed`
          : shipmentCodes,
        status: allCompleted ? "completed" : "pending",
        time: data.latestTime
      });
    });
    
    // Create grouped drop stops
    Object.entries(dropsByLocation).forEach(([locId, data]) => {
      const allCompleted = data.completedCount === data.shipments.length;
      const shipmentCodes = data.shipments.map(s => s.shipment_code).join(", ");
      stops.push({
        id: `drop-${locId}`,
        type: "drop",
        location_name: data.shipments.length > 1 
          ? `${data.locationName} (${data.shipments.length} drops)`
          : data.locationName,
        shipment_code: data.shipments.length > 1 
          ? `${data.completedCount}/${data.shipments.length} completed`
          : shipmentCodes,
        status: allCompleted ? "completed" : "pending",
        time: data.latestTime
      });
    });
    
    return stops;
  };

  // Generate enhanced timeline events with actual vs planned times and tracking data
  const getEnhancedTimelineEvents = (): EnhancedTimelineEvent[] => {
    if (!trip) return [];

    const events: EnhancedTimelineEvent[] = [];

    // Origin departure
    events.push({
      id: "origin",
      title: `Origin: ${trip.origin_location?.location_name || "Origin"}`,
      description: trip.origin_location?.city || undefined,
      type: "origin",
      status: trip.actual_start_time ? "completed" : 
              trip.status === "ongoing" ? "current" : "upcoming",
      plannedTime: trip.planned_start_time,
      actualTime: trip.actual_start_time,
      sequence: 0
    });

    // Get significant tracking points to show in timeline (sample to avoid clutter)
    // Show first, last, and key location changes
    const significantTrackingPoints: TrackingPoint[] = [];
    if (trackingPoints.length > 0) {
      // Always include first point
      significantTrackingPoints.push(trackingPoints[0]);
      
      // Sample intermediate points - show every ~10th point or when address changes significantly
      let lastAddress = "";
      for (let i = 1; i < trackingPoints.length - 1; i++) {
        const point = trackingPoints[i];
        const address = point.detailed_address || "";
        
        // Include if address changed significantly or at regular intervals
        const addressChanged = address && address !== lastAddress && 
          !address.includes(lastAddress.split(",")[0]);
        const isRegularInterval = i % Math.max(1, Math.floor(trackingPoints.length / 8)) === 0;
        
        if (addressChanged || isRegularInterval) {
          significantTrackingPoints.push(point);
          lastAddress = address;
        }
      }
      
      // Always include last point if different from first
      if (trackingPoints.length > 1) {
        significantTrackingPoints.push(trackingPoints[trackingPoints.length - 1]);
      }
    }

    // Add tracking points as timeline events
    significantTrackingPoints.forEach((point, index) => {
      const rawResponse = (point as any).raw_response as { address?: string } | null;
      const address = point.detailed_address || rawResponse?.address || `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
      
      events.push({
        id: `tracking-${point.id}`,
        title: index === 0 ? "Trip Started - First Location" : 
               index === significantTrackingPoints.length - 1 ? "Latest Location" : 
               `Location Update #${index + 1}`,
        description: address,
        type: "event",
        status: "completed",
        actualTime: point.event_time,
        sequence: index + 0.5 // Place between origin and waypoints
      });
    });

    // Add lane waypoints to timeline (if no trip waypoints exist)
    if (laneWaypoints.length > 0 && waypoints.length === 0) {
      laneWaypoints.forEach((lw, index) => {
        events.push({
          id: `lane-waypoint-${index}`,
          title: lw.name,
          description: "Route waypoint",
          type: "waypoint",
          status: "upcoming",
          sequence: 50 + index // Place between origin and destination
        });
      });
    }

    // Add trip waypoints events (if they exist)
    waypoints.forEach((waypoint, index) => {
      const waypointStatus = waypoint.status as "completed" | "current" | "upcoming" | "delayed" | "skipped";
      
      events.push({
        id: waypoint.id,
        title: waypoint.waypoint_name,
        description: waypoint.location?.location_name || waypoint.notes || undefined,
        type: "waypoint",
        status: waypoint.delay_minutes && waypoint.delay_minutes > 0 ? "delayed" : waypointStatus,
        plannedTime: waypoint.planned_arrival_time,
        actualTime: waypoint.actual_arrival_time,
        delayMinutes: waypoint.delay_minutes,
        sequence: index + 100 // Put waypoints after tracking events
      });
    });

    // Destination arrival
    events.push({
      id: "destination",
      title: `Destination: ${trip.destination_location?.location_name || "Destination"}`,
      description: trip.destination_location?.city || undefined,
      type: "destination",
      status: trip.actual_end_time ? "completed" : "upcoming",
      plannedTime: trip.planned_end_time,
      actualTime: trip.actual_end_time,
      sequence: 999 // Always last
    });

    // Sort by actualTime if available, otherwise by sequence
    return events.sort((a, b) => {
      if (a.actualTime && b.actualTime) {
        return new Date(a.actualTime).getTime() - new Date(b.actualTime).getTime();
      }
      return (a.sequence || 0) - (b.sequence || 0);
    });
  };

  // Generate timeline events from trip data and waypoints (legacy)
  const getTimelineEvents = (): TimelineEvent[] => {
    if (!trip) return [];

    const events: TimelineEvent[] = [];

    // Origin departure
    if (trip.actual_start_time) {
      events.push({
        id: "origin",
        time: new Date(trip.actual_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: `Origin Departure: ${trip.origin_location?.location_name || "Origin"}`,
        type: "origin",
        status: "completed"
      });
    } else if (trip.planned_start_time) {
      events.push({
        id: "origin",
        time: new Date(trip.planned_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: `Origin Departure: ${trip.origin_location?.location_name || "Origin"}`,
        type: "origin",
        status: trip.status === "created" ? "upcoming" : "current"
      });
    }

    // Add waypoint events
    waypoints.forEach((waypoint) => {
      const waypointStatus = waypoint.status as "completed" | "current" | "upcoming" | "delayed";
      const time = waypoint.actual_arrival_time || waypoint.planned_arrival_time;
      const delayMinutes = waypoint.delay_minutes;
      
      events.push({
        id: waypoint.id,
        time: time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--",
        title: waypoint.waypoint_name,
        description: waypoint.notes || waypoint.location?.location_name || undefined,
        type: waypoint.waypoint_type === "checkpoint" ? "event" : "waypoint",
        status: delayMinutes && delayMinutes > 0 ? "delayed" : waypointStatus,
        delay: delayMinutes && delayMinutes > 0 ? `${delayMinutes} min` : undefined
      });
    });

    // Destination arrival
    if (trip.actual_end_time) {
      events.push({
        id: "destination",
        time: new Date(trip.actual_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: `Destination Arrival: ${trip.destination_location?.location_name || "Destination"}`,
        type: "destination",
        status: "completed"
      });
    } else if (trip.planned_end_time) {
      events.push({
        id: "destination",
        time: new Date(trip.planned_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: `Destination Arrival: ${trip.destination_location?.location_name || "Destination"}`,
        type: "destination",
        status: "upcoming"
      });
    }

    return events;
  };

  // Generate sample alerts (in real app, these would come from tracking data)
  const getAlerts = (): TripAlert[] => {
    if (!trip || trip.status === "created") return [];
    
    // Sample alerts - in a real app these would come from tracking analysis
    return [];
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

  if (!trip) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-foreground mb-2">Trip not found</h2>
          <p className="text-muted-foreground mb-4">The requested trip could not be found.</p>
          <Button onClick={() => navigate("/trips")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trips
          </Button>
        </div>
      </Layout>
    );
  }

  const hasGpsTracking = trip.tracking_asset?.asset_type === "gps" || !!trip.vehicle?.tracking_asset_id || trip.tracking_type === "gps";
  const hasSimTracking = trip.tracking_asset?.asset_type === "sim" || trip.tracking_type === "sim";
  const consentStatus = trip.sim_consent?.consent_status || null;

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Button variant="outline" size="icon" onClick={() => navigate("/trips")} className="flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{trip.trip_code}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {trip.origin_location?.location_name} → {trip.destination_location?.location_name}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowManualLocationDialog(true)}>
              <Navigation className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Manual Location</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/trips/${id}/edit`)}>
              <Edit className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
        </div>

        {/* Map Section */}
        <TripMapSection
          originName={trip.origin_location?.location_name || "Origin"}
          originCity={trip.origin_location?.city}
          destinationName={trip.destination_location?.location_name || "Destination"}
          destinationCity={trip.destination_location?.city}
          originCoords={trip.origin_location?.latitude && trip.origin_location?.longitude 
            ? { lat: Number(trip.origin_location.latitude), lng: Number(trip.origin_location.longitude) }
            : null
          }
          destinationCoords={trip.destination_location?.latitude && trip.destination_location?.longitude
            ? { lat: Number(trip.destination_location.latitude), lng: Number(trip.destination_location.longitude) }
            : null
          }
          waypoints={[]}
          trackingPoints={trackingPoints}
          tripAlerts={tripAlerts.map((alert): TripAlertForMap => ({
            id: alert.id,
            alert_type: alert.alert_type,
            title: alert.title,
            description: alert.description,
            severity: alert.severity,
            status: alert.status,
            triggered_at: alert.triggered_at,
            location_latitude: alert.location_latitude,
            location_longitude: alert.location_longitude,
          }))}
          laneId={trip.lane_id}
          isTracking={trip.status === "ongoing"}
          onRefresh={fetchTrackingHistory}
          originGeofenceRadiusKm={originGeofenceRadiusKm}
          destinationGeofenceRadiusKm={destinationGeofenceRadiusKm}
          tripStatus={trip.status}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Trip Overview */}
            <TripOverviewCard
              tripCode={trip.trip_code}
              status={trip.status}
              distanceKm={trip.total_distance_km}
              shipmentStatus={loading ? 'loading' : shipments.length > 0 ? 'mapped' : 'no_shipments'}
              shipmentCount={shipments.length}
              currentEta={trip.current_eta}
              plannedEta={trip.planned_eta}
            />

            {/* Logistics Details */}
            <LogisticsDetailsCard
              vehicleNumber={trip.vehicle?.vehicle_number}
              vehicleMake={trip.vehicle?.make}
              vehicleModel={trip.vehicle?.model}
              transporterName={trip.transporter?.transporter_name}
              driverName={trip.driver?.name}
              driverMobile={trip.driver?.mobile}
            />

            {/* Tracking Status */}
            <TrackingStatusCard
              hasGpsTracking={hasGpsTracking}
              hasSimTracking={hasSimTracking}
              consentStatus={consentStatus}
            />

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {trip.status === "created" && (
                  <Button onClick={() => handleValidateLocation('start')} disabled={startingTrip || validatingLocation} className="w-full">
                    {startingTrip || validatingLocation ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    {startingTrip ? "Starting Trip..." : validatingLocation ? "Validating..." : "Start Trip"}
                  </Button>
                )}
                
                {trip.status === "ongoing" && (
                  <>
                    <Button 
                      onClick={handleFetchLocation} 
                      disabled={fetchingLocation} 
                      variant="secondary" 
                      className="w-full"
                    >
                      {fetchingLocation ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {fetchingLocation ? "Fetching..." : "Fetch Location Now"}
                    </Button>
                    <Button onClick={() => handleValidateLocation('complete')} disabled={completingTrip || validatingLocation} className="w-full">
                      {completingTrip || validatingLocation ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      {completingTrip ? "Completing..." : validatingLocation ? "Validating..." : "Complete Trip"}
                    </Button>
                    <Button onClick={() => handleStatusUpdate("on_hold")} variant="outline" className="w-full">
                      <Pause className="mr-2 h-4 w-4" />
                      Put On Hold
                    </Button>
                  </>
                )}
                
                {trip.status === "on_hold" && (
                  <Button onClick={() => handleStatusUpdate("ongoing")} className="w-full">
                    <Play className="mr-2 h-4 w-4" />
                    Resume Trip
                  </Button>
                )}
                
                {(trip.status === "created" || trip.status === "ongoing") && (
                  <Button onClick={() => handleStatusUpdate("cancelled")} variant="destructive" className="w-full">
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Trip
                  </Button>
                )}
                
                {trip.status === "completed" && (
                  <Button onClick={() => setShowClosureDialog(true)} className="w-full" variant="secondary">
                    <Lock className="mr-2 h-4 w-4" />
                    Close Trip
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Trip Exceptions Card */}
            <TripExceptionsCard
              tripId={trip.id}
              tripStatus={trip.status}
              currentDriverId={trip.driver_id}
              currentVehicleId={trip.vehicle_id}
              currentTrackingAssetId={trip.tracking_asset_id}
              currentDriverName={trip.driver?.name}
              currentVehicleNumber={trip.vehicle?.vehicle_number}
              transporterId={trip.transporter_id}
              onTripUpdated={fetchData}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* ETA Card */}
            <TripETACard
              originName={trip.origin_location?.location_name || "Origin"}
              destinationName={trip.destination_location?.location_name || "Destination"}
              totalDistanceKm={trip.total_distance_km}
              coveredDistanceKm={coveredDistanceKm}
              plannedStartTime={trip.planned_start_time}
              actualStartTime={trip.actual_start_time}
              plannedEndTime={trip.planned_end_time || trip.planned_eta}
              currentEta={trip.current_eta}
              averageSpeedKmph={40}
              tripStatus={trip.status}
            />

            {/* Monitoring Alerts (Database-backed) */}
            <TripAlertsMonitor 
              tripId={trip.id} 
              tripStatus={trip.status}
              onAlertChange={fetchData}
            />

            {/* Live Trip Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Trip Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <TripLiveTimeline
                  tripStatus={trip.status}
                  originName={trip.origin_location?.location_name || "Origin"}
                  destinationName={trip.destination_location?.location_name || "Destination"}
                  actualStartTime={trip.actual_start_time}
                  actualEndTime={trip.actual_end_time}
                  plannedEndTime={trip.planned_end_time || trip.planned_eta}
                  currentLocation={
                    trackingPoints.length > 0
                      ? {
                          latitude: trackingPoints[trackingPoints.length - 1].latitude,
                          longitude: trackingPoints[trackingPoints.length - 1].longitude,
                          address: trackingPoints[trackingPoints.length - 1].detailed_address || undefined,
                          time: trackingPoints[trackingPoints.length - 1].event_time
                        }
                      : null
                  }
                  shipmentStops={getShipmentStops()}
                  alerts={tripAlerts}
                  vehicleProgressPercent={vehicleProgressPercent}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Shipment Mapper Section */}
        <ShipmentMapper
          tripId={trip.id}
          freightType={trip.lane_id ? "ptl" : "ftl"}
          vehicleCapacity={
            trip.vehicle?.id 
              ? { weight_capacity_kg: null, volume_capacity_cbm: null } // TODO: Get from vehicle type
              : null
          }
          onMappingChange={fetchShipments}
        />

        {/* Shipments Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Trip Shipments ({shipments.length})
            </CardTitle>
            <Button size="sm" onClick={handleAddShipment}>
              <Plus className="h-4 w-4 mr-1" />
              Add Manual
            </Button>
          </CardHeader>
          <CardContent>
            {shipments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No shipments mapped to this trip yet. Use the mapper above to add shipments.</p>
            ) : (
              <div className="space-y-3">
                {shipments.map((shipment) => (
                  <div 
                    key={shipment.id} 
                    className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 ${
                      shipment.pod_collected ? 'border-green-500/30 bg-green-500/5' : ''
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{shipment.shipment_code}</span>
                        <Badge variant={shipmentStatusColors[shipment.status] || "outline"} className="text-xs">
                          {shipment.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {shipment.pickup_location?.location_name} → {shipment.drop_location?.location_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {shipment.material?.name && <span>{shipment.material.name}</span>}
                        {shipment.quantity && <span> • Qty: {shipment.quantity}</span>}
                        {shipment.weight_kg && <span> • {shipment.weight_kg} kg</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* POD Upload */}
                      <ShipmentPodUpload
                        shipmentId={shipment.id}
                        shipmentCode={shipment.shipment_code}
                        podFilePath={shipment.pod_file_path}
                        podFileName={shipment.pod_file_name}
                        podCollected={shipment.pod_collected}
                        onUploadComplete={fetchShipments}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditShipment(shipment)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteShipment(shipment)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip Closure Dialog */}
      <TripClosureDialog
        open={showClosureDialog}
        onOpenChange={setShowClosureDialog}
        tripId={trip.id}
        tripCode={trip.trip_code}
        onClosed={fetchData}
      />


      {/* Shipment Dialog */}
      <FormDialog
        open={isShipmentDialogOpen}
        onOpenChange={setIsShipmentDialogOpen}
        title={editingShipment ? "Edit Shipment" : "Add Shipment"}
        description={editingShipment ? "Update shipment details" : "Add a new shipment to this trip"}
        onSubmit={handleSubmitShipment}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shipment_code">Shipment Code *</Label>
            <Input
              id="shipment_code"
              value={shipmentFormData.shipment_code}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, shipment_code: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select 
              value={shipmentFormData.status} 
              onValueChange={(value) => setShipmentFormData({ ...shipmentFormData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_pickup">In Pickup</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="ndr">NDR</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pickup_location_id">Pickup Location</Label>
            <Select 
              value={shipmentFormData.pickup_location_id} 
              onValueChange={(value) => setShipmentFormData({ ...shipmentFormData, pickup_location_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pickup" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="drop_location_id">Drop Location</Label>
            <Select 
              value={shipmentFormData.drop_location_id} 
              onValueChange={(value) => setShipmentFormData({ ...shipmentFormData, drop_location_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select drop" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="customer_id">Customer</Label>
            <Select 
              value={shipmentFormData.customer_id} 
              onValueChange={(value) => setShipmentFormData({ ...shipmentFormData, customer_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="material_id">Material</Label>
            <Select 
              value={shipmentFormData.material_id} 
              onValueChange={(value) => setShipmentFormData({ ...shipmentFormData, material_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={shipmentFormData.quantity}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, quantity: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="weight_kg">Weight (kg)</Label>
            <Input
              id="weight_kg"
              type="number"
              step="0.01"
              value={shipmentFormData.weight_kg}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, weight_kg: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="volume_cbm">Volume (CBM)</Label>
            <Input
              id="volume_cbm"
              type="number"
              step="0.001"
              value={shipmentFormData.volume_cbm}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, volume_cbm: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="order_id">Order ID</Label>
            <Input
              id="order_id"
              value={shipmentFormData.order_id}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, order_id: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="lr_number">LR Number</Label>
            <Input
              id="lr_number"
              value={shipmentFormData.lr_number}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, lr_number: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="waybill_number">Waybill Number</Label>
            <Input
              id="waybill_number"
              value={shipmentFormData.waybill_number}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, waybill_number: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={shipmentFormData.notes}
              onChange={(e) => setShipmentFormData({ ...shipmentFormData, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
      </FormDialog>

      {/* Waypoint Dialog */}
      <FormDialog
        open={isWaypointDialogOpen}
        onOpenChange={setIsWaypointDialogOpen}
        title={editingWaypoint ? "Edit Waypoint" : "Add Waypoint"}
        description={editingWaypoint ? "Update waypoint details" : "Add a new waypoint to this trip"}
        onSubmit={handleSubmitWaypoint}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="waypoint_name">Waypoint Name *</Label>
            <Input
              id="waypoint_name"
              value={waypointFormData.waypoint_name}
              onChange={(e) => setWaypointFormData({ ...waypointFormData, waypoint_name: e.target.value })}
              placeholder="e.g., Toll Plaza, Rest Stop, Checkpoint"
              maxLength={100}
              required
            />
          </div>

          <div>
            <Label htmlFor="waypoint_type">Type</Label>
            <Select 
              value={waypointFormData.waypoint_type} 
              onValueChange={(value) => setWaypointFormData({ ...waypointFormData, waypoint_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stop">Stop</SelectItem>
                <SelectItem value="checkpoint">Checkpoint</SelectItem>
                <SelectItem value="rest">Rest Area</SelectItem>
                <SelectItem value="fuel">Fuel Station</SelectItem>
                <SelectItem value="toll">Toll Plaza</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="waypoint_status">Status</Label>
            <Select 
              value={waypointFormData.status} 
              onValueChange={(value) => setWaypointFormData({ ...waypointFormData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location_id">Location (Optional)</Label>
            <Select 
              value={waypointFormData.location_id} 
              onValueChange={(value) => setWaypointFormData({ ...waypointFormData, location_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sequence_order">Sequence Order</Label>
            <Input
              id="sequence_order"
              type="number"
              min="0"
              value={waypointFormData.sequence_order}
              onChange={(e) => setWaypointFormData({ ...waypointFormData, sequence_order: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="planned_arrival_time">Planned Arrival</Label>
            <Input
              id="planned_arrival_time"
              type="datetime-local"
              value={waypointFormData.planned_arrival_time}
              onChange={(e) => setWaypointFormData({ ...waypointFormData, planned_arrival_time: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="planned_departure_time">Planned Departure</Label>
            <Input
              id="planned_departure_time"
              type="datetime-local"
              value={waypointFormData.planned_departure_time}
              onChange={(e) => setWaypointFormData({ ...waypointFormData, planned_departure_time: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="waypoint_notes">Notes</Label>
            <Textarea
              id="waypoint_notes"
              value={waypointFormData.notes}
              onChange={(e) => setWaypointFormData({ ...waypointFormData, notes: e.target.value })}
              rows={2}
              maxLength={500}
              placeholder="Additional notes about this waypoint"
            />
          </div>
        </div>
      </FormDialog>

      {/* Location Validation Dialog */}
      <LocationValidationDialog
        open={showValidationDialog}
        onOpenChange={setShowValidationDialog}
        validationResult={validationResult}
        actionType={validationAction}
        loading={startingTrip || completingTrip || validatingLocation}
        onConfirm={handleValidationConfirm}
        onOverride={handleValidationOverride}
        onRetry={handleValidationRetry}
        onManualLocationUpdate={() => setShowManualLocationDialog(true)}
      />

      {/* Manual Location Update Dialog */}
      <ManualLocationUpdateDialog
        open={showManualLocationDialog}
        onOpenChange={setShowManualLocationDialog}
        tripId={trip.id}
        tripCode={trip.trip_code}
        onSuccess={() => {
          fetchTrackingHistory();
          fetchTrip();
          
          // Auto-retry the trip action after manual location update
          if (validationAction === "complete") {
            toast({
              title: "Retrying Trip Completion",
              description: "Validating new location against destination...",
            });
            setTimeout(() => {
              handleCompleteTrip();
            }, 500);
          } else if (validationAction === "start") {
            toast({
              title: "Retrying Trip Start",
              description: "Validating new location against origin...",
            });
            setTimeout(() => {
              handleStartTrip();
            }, 500);
          }
        }}
      />
    </Layout>
  );
}
