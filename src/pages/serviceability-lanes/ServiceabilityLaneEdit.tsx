import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusToggle } from "@/components/StatusToggle";
import { LaneRouteCalculator, RouteData, LocationCoords } from "@/components/lane/LaneRouteCalculator";
import { useLaneRouteCalculation } from "@/hooks/useLaneRouteCalculation";

interface Location {
  id: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface Transporter {
  id: string;
  transporter_name: string;
}

interface VehicleType {
  id: string;
  type_name: string;
}

export default function ServiceabilityLaneEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const { routeCalculation, saveRouteCalculation, getRouteDataFromCalculation } = useLaneRouteCalculation(id);
  
  const [formData, setFormData] = useState({
    lane_code: "",
    origin_location_id: "",
    destination_location_id: "",
    transporter_id: "",
    vehicle_type_id: "",
    freight_type: "ftl" as "ftl" | "ptl" | "express",
    serviceability_mode: "surface" as "surface" | "air" | "rail",
    distance_km: "",
    standard_tat_hours: "",
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  // Set initial route data from saved calculation
  useEffect(() => {
    if (routeCalculation) {
      const savedRoute = getRouteDataFromCalculation();
      if (savedRoute) {
        setRouteData(savedRoute);
      }
    }
  }, [routeCalculation]);

  const fetchData = async () => {
    const [laneRes, locRes, transRes, vtRes] = await Promise.all([
      supabase.from("serviceability_lanes").select("*").eq("id", id).single(),
      supabase.from("locations").select("id, location_name, latitude, longitude").eq("is_active", true),
      supabase.from("transporters").select("id, transporter_name").eq("is_active", true),
      supabase.from("vehicle_types").select("id, type_name").eq("is_active", true),
    ]);

    if (laneRes.data) {
      setFormData({
        lane_code: laneRes.data.lane_code || "",
        origin_location_id: laneRes.data.origin_location_id || "",
        destination_location_id: laneRes.data.destination_location_id || "",
        transporter_id: laneRes.data.transporter_id || "",
        vehicle_type_id: laneRes.data.vehicle_type_id || "",
        freight_type: laneRes.data.freight_type || "ftl",
        serviceability_mode: laneRes.data.serviceability_mode || "surface",
        distance_km: laneRes.data.distance_km?.toString() || "",
        standard_tat_hours: laneRes.data.standard_tat_hours?.toString() || "",
        is_active: laneRes.data.is_active,
      });
    }
    if (locRes.data) setLocations(locRes.data);
    if (transRes.data) setTransporters(transRes.data);
    if (vtRes.data) setVehicleTypes(vtRes.data);
    setLoading(false);
  };

  // Get origin and destination coordinates for route calculator
  const originCoords: LocationCoords | undefined = useMemo(() => {
    const originLoc = locations.find((l) => l.id === formData.origin_location_id);
    if (originLoc?.latitude && originLoc?.longitude) {
      return { lat: originLoc.latitude, lng: originLoc.longitude, name: originLoc.location_name };
    }
    return undefined;
  }, [locations, formData.origin_location_id]);

  const destinationCoords: LocationCoords | undefined = useMemo(() => {
    const destLoc = locations.find((l) => l.id === formData.destination_location_id);
    if (destLoc?.latitude && destLoc?.longitude) {
      return { lat: destLoc.latitude, lng: destLoc.longitude, name: destLoc.location_name };
    }
    return undefined;
  }, [locations, formData.destination_location_id]);

  // Get TAT multiplier based on serviceability mode
  const getTatMultiplier = (mode: string): number => {
    switch (mode) {
      case 'air': return 0.15; // Air is ~6-7x faster than road
      case 'rail': return 0.7; // Rail is ~1.4x faster than road
      default: return 1.0; // Surface (driving)
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Handle route calculation result
  const handleRouteCalculated = (data: RouteData) => {
    setRouteData(data);
    // Auto-populate distance and TAT from route calculation
    const distanceKm = (data.totalDistanceMeters / 1000).toFixed(2);
    // Store TAT as decimal hours for precision
    const baseHours = data.totalDurationSeconds / 3600;
    const adjustedHours = baseHours * getTatMultiplier(formData.serviceability_mode);
    setFormData((prev) => ({
      ...prev,
      distance_km: distanceKm,
      standard_tat_hours: adjustedHours.toFixed(2),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from("serviceability_lanes").update({
        lane_code: formData.lane_code,
        origin_location_id: formData.origin_location_id,
        destination_location_id: formData.destination_location_id,
        transporter_id: formData.transporter_id || null,
        vehicle_type_id: formData.vehicle_type_id || null,
        freight_type: formData.freight_type,
        serviceability_mode: formData.serviceability_mode,
        distance_km: formData.distance_km ? parseFloat(formData.distance_km) : null,
        standard_tat_hours: formData.standard_tat_hours ? parseFloat(formData.standard_tat_hours) : null,
        is_active: formData.is_active,
      }).eq("id", id);

      if (error) throw error;

      // Save route calculation if available
      if (routeData && id) {
        await saveRouteCalculation(id, routeData);
      }

      toast({ title: "Serviceability lane updated successfully" });
      navigate("/serviceability-lanes");
    } catch (error: any) {
      toast({ title: "Error updating lane", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/serviceability-lanes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Edit Serviceability Lane</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lane Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lane_code">Lane Code *</Label>
                <Input
                  id="lane_code"
                  value={formData.lane_code}
                  onChange={(e) => setFormData({ ...formData, lane_code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin_location_id">Origin Location *</Label>
                <Select value={formData.origin_location_id} onValueChange={(value) => setFormData({ ...formData, origin_location_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select origin" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination_location_id">Destination Location *</Label>
                <Select value={formData.destination_location_id} onValueChange={(value) => setFormData({ ...formData, destination_location_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.location_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transporter_id">Transporter</Label>
                <Select value={formData.transporter_id} onValueChange={(value) => setFormData({ ...formData, transporter_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transporter" />
                  </SelectTrigger>
                  <SelectContent>
                    {transporters.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.transporter_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_type_id">Vehicle Type</Label>
                <Select value={formData.vehicle_type_id} onValueChange={(value) => setFormData({ ...formData, vehicle_type_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.id} value={vt.id}>{vt.type_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Route Calculator */}
          <LaneRouteCalculator
            origin={originCoords}
            destination={destinationCoords}
            onRouteCalculated={handleRouteCalculated}
            initialRouteData={routeData}
          />

          <Card>
            <CardHeader>
              <CardTitle>Service Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="freight_type">Freight Type *</Label>
                <Select value={formData.freight_type} onValueChange={(value: any) => setFormData({ ...formData, freight_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ftl">FTL</SelectItem>
                    <SelectItem value="ptl">PTL</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceability_mode">Mode *</Label>
                <Select 
                  value={formData.serviceability_mode} 
                  onValueChange={(value: any) => {
                    // Recalculate TAT if route data exists
                    if (routeData) {
                      const baseHours = routeData.totalDurationSeconds / 3600;
                      const adjustedHours = baseHours * getTatMultiplier(value);
                      setFormData(prev => ({
                        ...prev,
                        serviceability_mode: value,
                        standard_tat_hours: adjustedHours.toFixed(2),
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, serviceability_mode: value }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surface">Surface</SelectItem>
                    <SelectItem value="air">Air</SelectItem>
                    <SelectItem value="rail">Rail</SelectItem>
                  </SelectContent>
                </Select>
                {formData.serviceability_mode !== 'surface' && (
                  <p className="text-xs text-muted-foreground">
                    TAT adjusted: {formData.serviceability_mode === 'air' ? '~6x faster' : '~1.4x faster'} than surface
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="distance_km">Distance (km)</Label>
                <Input
                  id="distance_km"
                  type="number"
                  step="0.01"
                  value={formData.distance_km}
                  onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                  placeholder="Auto-calculated from route"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="standard_tat_hours">Standard TAT</Label>
                <Input
                  id="standard_tat_hours"
                  type="number"
                  step="0.01"
                  value={formData.standard_tat_hours}
                  onChange={(e) => setFormData({ ...formData, standard_tat_hours: e.target.value })}
                  placeholder="Auto-calculated from route"
                />
                {formData.standard_tat_hours && (
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(parseFloat(formData.standard_tat_hours) * 3600)}
                    {formData.serviceability_mode !== 'surface' && (
                      <span className="ml-1 text-primary">
                        (adjusted for {formData.serviceability_mode} transport)
                      </span>
                    )}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <StatusToggle isActive={formData.is_active} onToggle={(value) => setFormData({ ...formData, is_active: value })} />

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/serviceability-lanes")}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
