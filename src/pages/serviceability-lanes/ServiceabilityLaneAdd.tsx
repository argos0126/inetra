import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StatusToggle } from "@/components/StatusToggle";
import { LaneRouteCalculator, RouteData, LocationCoords } from "@/components/lane/LaneRouteCalculator";
import { Badge } from "@/components/ui/badge";

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

export default function ServiceabilityLaneAdd() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [allRoutes, setAllRoutes] = useState<RouteData[]>([]);
  const [selectedRouteIndices, setSelectedRouteIndices] = useState<number[]>([0]);
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
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    const [locRes, transRes, vtRes] = await Promise.all([
      supabase.from("locations").select("id, location_name, latitude, longitude").eq("is_active", true),
      supabase.from("transporters").select("id, transporter_name").eq("is_active", true),
      supabase.from("vehicle_types").select("id, type_name").eq("is_active", true),
    ]);
    if (locRes.data) setLocations(locRes.data);
    if (transRes.data) setTransporters(transRes.data);
    if (vtRes.data) setVehicleTypes(vtRes.data);
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

  // Handle route calculation result
  const handleRouteCalculated = (data: RouteData) => {
    setRouteData(data);
    // Auto-populate distance and TAT from route calculation
    const distanceKm = (data.totalDistanceMeters / 1000).toFixed(2);
    // Store TAT as decimal hours for precision (e.g., 0.43 for 26 mins)
    const baseHours = data.totalDurationSeconds / 3600;
    const adjustedHours = baseHours * getTatMultiplier(formData.serviceability_mode);
    setFormData((prev) => ({
      ...prev,
      distance_km: distanceKm,
      standard_tat_hours: adjustedHours.toFixed(2),
    }));
  };

  // Handle multiple routes found
  const handleMultipleRoutesFound = (routes: RouteData[]) => {
    setAllRoutes(routes);
    setSelectedRouteIndices([0]); // Select first route by default
  };

  // Toggle route selection
  const toggleRouteSelection = (index: number) => {
    setSelectedRouteIndices(prev => {
      if (prev.includes(index)) {
        // Don't allow deselecting if it's the only selected route
        if (prev.length === 1) return prev;
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index].sort((a, b) => a - b);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.lane_code || !formData.origin_location_id || !formData.destination_location_id) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const routesToSave = allRoutes.length > 1 
        ? selectedRouteIndices.map(i => allRoutes[i])
        : routeData ? [routeData] : [];

      if (routesToSave.length === 0 && !routeData) {
        // No route calculated, save single lane without route data
        const { error: laneError } = await supabase.from("serviceability_lanes").insert({
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
        });

        if (laneError) throw laneError;
        toast({ title: "Serviceability lane created successfully" });
      } else {
        // Save each selected route as a separate lane
        for (let i = 0; i < routesToSave.length; i++) {
          const route = routesToSave[i];
          const laneCode = routesToSave.length > 1 
            ? `${formData.lane_code}-${String(i + 1).padStart(2, '0')}`
            : formData.lane_code;

          const distanceKm = (route.totalDistanceMeters / 1000).toFixed(2);
          // Apply mode multiplier for TAT
          const baseHours = route.totalDurationSeconds / 3600;
          const tatHours = (baseHours * getTatMultiplier(formData.serviceability_mode)).toFixed(2);

          // Insert the lane
          const { data: laneData, error: laneError } = await supabase.from("serviceability_lanes").insert({
            lane_code: laneCode,
            origin_location_id: formData.origin_location_id,
            destination_location_id: formData.destination_location_id,
            transporter_id: formData.transporter_id || null,
            vehicle_type_id: formData.vehicle_type_id || null,
            freight_type: formData.freight_type,
            serviceability_mode: formData.serviceability_mode,
            distance_km: parseFloat(distanceKm),
            standard_tat_hours: parseFloat(tatHours),
            is_active: formData.is_active,
          }).select("id").single();

          if (laneError) throw laneError;

          // Save route calculation with waypoints as JSON
          if (laneData) {
            const waypoints = route.waypointCoordinates?.map((wp, wpIndex) => ({
              sequence: wpIndex + 1,
              lat: wp.lat,
              lng: wp.lng,
              name: wp.name || `Waypoint ${wpIndex + 1}`,
              type: 'via',
            })) || [];

            await supabase.from("lane_route_calculations").insert({
              lane_id: laneData.id,
              encoded_polyline: route.encodedPolyline,
              total_distance_meters: route.totalDistanceMeters,
              total_duration_seconds: route.totalDurationSeconds,
              route_summary: route.routeSummary,
              waypoints: waypoints,
              calculated_at: new Date().toISOString(),
            });
          }
        }

        const message = routesToSave.length > 1 
          ? `${routesToSave.length} lanes created successfully (${formData.lane_code}-01 to ${formData.lane_code}-${String(routesToSave.length).padStart(2, '0')})`
          : "Serviceability lane created successfully";
        
        toast({ title: message });
      }

      navigate("/serviceability-lanes");
    } catch (error: any) {
      toast({ title: "Error creating lane", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters: number) => (meters / 1000).toFixed(1) + " km";
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/serviceability-lanes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">Add Serviceability Lane</h1>
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
                  placeholder="e.g., DEL-MUM"
                  required
                />
                {allRoutes.length > 1 && selectedRouteIndices.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Will create: {selectedRouteIndices.map(i => `${formData.lane_code}-${String(i + 1).padStart(2, '0')}`).join(', ')}
                  </p>
                )}
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

          {/* Route Calculator - showMultiRouteSelection=false to avoid redundant selection */}
          <LaneRouteCalculator
            origin={originCoords}
            destination={destinationCoords}
            onRouteCalculated={handleRouteCalculated}
            onMultipleRoutesFound={handleMultipleRoutesFound}
            showMultiRouteSelection={false}
          />

          {/* Multi-Route Selection with Checkboxes */}
          {allRoutes.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Select Routes to Save</span>
                  <Badge variant="secondary">{selectedRouteIndices.length} of {allRoutes.length} selected</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Each selected route will be saved as a separate lane with suffix (-01, -02, etc.)
                </p>
                {allRoutes.map((route, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={`route-${index}`}
                      checked={selectedRouteIndices.includes(index)}
                      onCheckedChange={() => toggleRouteSelection(index)}
                    />
                    <label htmlFor={`route-${index}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {formData.lane_code}-{String(index + 1).padStart(2, '0')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            via {route.routeSummary || `Route ${index + 1}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{formatDistance(route.totalDistanceMeters)}</Badge>
                          <Badge variant="outline">{formatDuration(route.totalDurationSeconds)}</Badge>
                          {route.waypointCoordinates && (
                            <Badge variant="secondary">{route.waypointCoordinates.length} waypoints</Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
                    setFormData({ ...formData, serviceability_mode: value });
                    // Recalculate TAT if route data exists
                    if (routeData) {
                      const baseHours = routeData.totalDurationSeconds / 3600;
                      const adjustedHours = baseHours * getTatMultiplier(value);
                      setFormData(prev => ({
                        ...prev,
                        serviceability_mode: value,
                        standard_tat_hours: adjustedHours.toFixed(2),
                      }));
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
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {allRoutes.length > 1 && selectedRouteIndices.length > 1 
                    ? `Save ${selectedRouteIndices.length} Lanes` 
                    : "Save"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
