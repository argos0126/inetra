import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Route, Loader2, Navigation, Clock, Ruler, MapPin, Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Location {
  id: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface RouteData {
  encodedPolyline: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  routeSummary: string;
  waypointCoordinates?: Array<{ lat: number; lng: number; name: string }>;
}

interface ExistingLane {
  id: string;
  lane_code: string;
  distance_km: number | null;
}

interface TripLaneGeneratorProps {
  originLocationId: string;
  destinationLocationId: string;
  locations: Location[];
  onLaneSelected: (laneId: string) => void;
  onLanesCreated: (lanes: ExistingLane[]) => void;
}

export function TripLaneGenerator({
  originLocationId,
  destinationLocationId,
  locations,
  onLaneSelected,
  onLanesCreated,
}: TripLaneGeneratorProps) {
  const { toast } = useToast();
  const [existingLanes, setExistingLanes] = useState<ExistingLane[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allRoutes, setAllRoutes] = useState<RouteData[]>([]);
  const [selectedRouteIndices, setSelectedRouteIndices] = useState<number[]>([0]);
  const [baseLaneCode, setBaseLaneCode] = useState("");

  const originLocation = useMemo(
    () => locations.find((l) => l.id === originLocationId),
    [locations, originLocationId]
  );

  const destinationLocation = useMemo(
    () => locations.find((l) => l.id === destinationLocationId),
    [locations, destinationLocationId]
  );

  // Generate lane code from location names
  const generateLaneCode = (origin: string, destination: string): string => {
    const getPrefix = (name: string) => {
      // Remove common suffixes and get first 3 letters uppercase
      const cleaned = name.replace(/\s+(city|town|district|hub|warehouse|plant)$/i, "").trim();
      return cleaned.substring(0, 3).toUpperCase();
    };
    return `${getPrefix(origin)}-${getPrefix(destination)}`;
  };

  // Check for existing lanes when origin/destination change
  useEffect(() => {
    if (originLocationId && destinationLocationId) {
      fetchExistingLanes();
      // Auto-generate lane code
      if (originLocation && destinationLocation) {
        setBaseLaneCode(generateLaneCode(originLocation.location_name, destinationLocation.location_name));
      }
    } else {
      setExistingLanes([]);
      setAllRoutes([]);
      setBaseLaneCode("");
    }
  }, [originLocationId, destinationLocationId, originLocation, destinationLocation]);

  const fetchExistingLanes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("serviceability_lanes")
        .select("id, lane_code, distance_km")
        .eq("origin_location_id", originLocationId)
        .eq("destination_location_id", destinationLocationId)
        .eq("is_active", true);

      if (error) throw error;
      setExistingLanes(data || []);
    } catch (error: any) {
      console.error("Error fetching lanes:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRoutes = async () => {
    if (!originLocation?.latitude || !originLocation?.longitude || 
        !destinationLocation?.latitude || !destinationLocation?.longitude) {
      toast({
        title: "Missing coordinates",
        description: "Origin and destination must have valid coordinates",
        variant: "destructive",
      });
      return;
    }

    setCalculating(true);
    setAllRoutes([]);

    try {
      const { data, error } = await supabase.functions.invoke("google-maps-route", {
        body: {
          origin: { lat: originLocation.latitude, lng: originLocation.longitude, name: originLocation.location_name },
          destination: { lat: destinationLocation.latitude, lng: destinationLocation.longitude, name: destinationLocation.location_name },
          waypoints: [],
          alternatives: true,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to calculate route");

      if (data.routes && data.routes.length > 0) {
        setAllRoutes(data.routes);
        setSelectedRouteIndices([0]);
        toast({ title: `${data.routes.length} route(s) found` });
      }
    } catch (error: any) {
      toast({ title: "Route calculation failed", description: error.message, variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  };

  const toggleRouteSelection = (index: number) => {
    setSelectedRouteIndices((prev) => {
      if (prev.includes(index)) {
        if (prev.length === 1) return prev;
        return prev.filter((i) => i !== index);
      }
      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const saveSelectedRoutes = async () => {
    if (!baseLaneCode.trim()) {
      toast({ title: "Lane code is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const createdLanes: ExistingLane[] = [];

      for (let i = 0; i < selectedRouteIndices.length; i++) {
        const routeIndex = selectedRouteIndices[i];
        const route = allRoutes[routeIndex];
        const laneCode = selectedRouteIndices.length > 1 
          ? `${baseLaneCode}-${String(i + 1).padStart(2, "0")}`
          : baseLaneCode;

        const distanceKm = parseFloat((route.totalDistanceMeters / 1000).toFixed(2));
        const tatHours = Math.ceil(route.totalDurationSeconds / 3600);

        // Insert lane
        const { data: laneData, error: laneError } = await supabase
          .from("serviceability_lanes")
          .insert({
            lane_code: laneCode,
            origin_location_id: originLocationId,
            destination_location_id: destinationLocationId,
            freight_type: "ftl",
            serviceability_mode: "surface",
            distance_km: distanceKm,
            standard_tat_hours: tatHours,
            is_active: true,
          })
          .select("id, lane_code, distance_km")
          .single();

        if (laneError) throw laneError;

        // Save route calculation with waypoints as JSON
        if (laneData) {
          const waypoints = route.waypointCoordinates?.map((wp, wpIndex) => ({
            sequence: wpIndex + 1,
            lat: wp.lat,
            lng: wp.lng,
            name: wp.name || `Waypoint ${wpIndex + 1}`,
            type: "via",
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

          createdLanes.push(laneData);
        }
      }

      toast({
        title: `${createdLanes.length} lane(s) created`,
        description: createdLanes.map((l) => l.lane_code).join(", "),
      });

      // Refresh existing lanes
      await fetchExistingLanes();
      setAllRoutes([]);
      onLanesCreated(createdLanes);

      // Auto-select first created lane
      if (createdLanes.length > 0) {
        onLaneSelected(createdLanes[0].id);
      }
    } catch (error: any) {
      toast({ title: "Error creating lanes", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatDistance = (meters: number) => (meters / 1000).toFixed(1) + " km";
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (!originLocationId || !destinationLocationId) {
    return null;
  }

  const hasCoordinates = originLocation?.latitude && originLocation?.longitude && 
                         destinationLocation?.latitude && destinationLocation?.longitude;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Lane Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : existingLanes.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {existingLanes.length} existing lane(s) found for this route:
            </p>
            <div className="space-y-2">
              {existingLanes.map((lane) => (
                <div
                  key={lane.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                  onClick={() => onLaneSelected(lane.id)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{lane.lane_code}</Badge>
                    {lane.distance_km && (
                      <span className="text-sm text-muted-foreground">{lane.distance_km} km</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    Select
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-2">Or create a new lane:</p>
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No existing lane found for this origin-destination pair.
            </p>
          </div>
        )}

        {/* Generate New Lane Section */}
        {hasCoordinates && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base_lane_code">Lane Code</Label>
                <Input
                  id="base_lane_code"
                  value={baseLaneCode}
                  onChange={(e) => setBaseLaneCode(e.target.value.toUpperCase())}
                  placeholder="e.g., MUM-DEL"
                />
                {allRoutes.length > 1 && selectedRouteIndices.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Will create: {selectedRouteIndices.map((_, i) => `${baseLaneCode}-${String(i + 1).padStart(2, "0")}`).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={calculateRoutes}
                  disabled={calculating}
                  className="w-full"
                >
                  {calculating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finding Routes...
                    </>
                  ) : (
                    <>
                      <Navigation className="mr-2 h-4 w-4" />
                      Calculate Routes
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Route Selection */}
            {allRoutes.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Select route(s) to save as lane(s):
                </p>
                {allRoutes.map((route, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`route-select-${index}`}
                      checked={selectedRouteIndices.includes(index)}
                      onCheckedChange={() => toggleRouteSelection(index)}
                    />
                    <label htmlFor={`route-select-${index}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {selectedRouteIndices.length > 1 
                              ? `${baseLaneCode}-${String(selectedRouteIndices.indexOf(index) + 1).padStart(2, "0")}`
                              : baseLaneCode || `Route ${index + 1}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            via {route.routeSummary || `Route ${index + 1}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Ruler className="h-3 w-3" />
                            {formatDistance(route.totalDistanceMeters)}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(route.totalDurationSeconds)}
                          </Badge>
                          {route.waypointCoordinates && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {route.waypointCoordinates.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}

                <Button
                  type="button"
                  onClick={saveSelectedRoutes}
                  disabled={saving || !baseLaneCode.trim()}
                  className="w-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create {selectedRouteIndices.length} Lane(s)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {!hasCoordinates && (
          <p className="text-sm text-destructive">
            Origin and destination must have valid coordinates to calculate routes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
