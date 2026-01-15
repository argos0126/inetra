import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  MapPin, Plus, Trash2, GripVertical, ArrowDown, Loader2, 
  Navigation, Clock, AlertTriangle, Route 
} from "lucide-react";

interface Location {
  id: string;
  location_name: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Waypoint {
  id?: string;
  location_id: string | null;
  waypoint_name: string;
  waypoint_type: 'origin' | 'stop' | 'destination';
  sequence_order: number;
  planned_arrival_time?: string | null;
  planned_departure_time?: string | null;
  status: string;
  location?: Location | null;
}

interface TripWaypointManagerProps {
  tripId?: string;
  originLocationId: string | null;
  destinationLocationId: string | null;
  locations: Location[];
  onWaypointsChange?: (waypoints: Waypoint[]) => void;
  readOnly?: boolean;
}

export function TripWaypointManager({
  tripId,
  originLocationId,
  destinationLocationId,
  locations,
  onWaypointsChange,
  readOnly = false
}: TripWaypointManagerProps) {
  const { toast } = useToast();
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLocationId, setNewLocationId] = useState<string>("");

  useEffect(() => {
    if (tripId) {
      fetchWaypoints();
    } else {
      // Initialize with origin and destination
      initializeWaypoints();
    }
  }, [tripId, originLocationId, destinationLocationId]);

  const initializeWaypoints = () => {
    const initialWaypoints: Waypoint[] = [];
    
    if (originLocationId) {
      const originLocation = locations.find(l => l.id === originLocationId);
      initialWaypoints.push({
        location_id: originLocationId,
        waypoint_name: originLocation?.location_name || 'Origin',
        waypoint_type: 'origin',
        sequence_order: 0,
        status: 'pending',
        location: originLocation
      });
    }
    
    if (destinationLocationId) {
      const destLocation = locations.find(l => l.id === destinationLocationId);
      initialWaypoints.push({
        location_id: destinationLocationId,
        waypoint_name: destLocation?.location_name || 'Destination',
        waypoint_type: 'destination',
        sequence_order: 999,
        status: 'pending',
        location: destLocation
      });
    }
    
    setWaypoints(initialWaypoints);
    onWaypointsChange?.(initialWaypoints);
  };

  const fetchWaypoints = async () => {
    if (!tripId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trip_waypoints")
        .select(`
          id,
          location_id,
          waypoint_name,
          waypoint_type,
          sequence_order,
          planned_arrival_time,
          planned_departure_time,
          status,
          location:locations(id, location_name, city, state, latitude, longitude)
        `)
        .eq("trip_id", tripId)
        .order("sequence_order");

      if (error) throw error;

      const loadedWaypoints = (data || []).map((w: any) => ({
        ...w,
        location: w.location as Location | null
      }));
      
      setWaypoints(loadedWaypoints);
      onWaypointsChange?.(loadedWaypoints);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addWaypoint = () => {
    if (!newLocationId) return;

    const location = locations.find(l => l.id === newLocationId);
    if (!location) return;

    // Insert before destination
    const stops = waypoints.filter(w => w.waypoint_type === 'stop');
    const newSequence = stops.length + 1;

    const newWaypoint: Waypoint = {
      location_id: newLocationId,
      waypoint_name: location.location_name,
      waypoint_type: 'stop',
      sequence_order: newSequence,
      status: 'pending',
      location
    };

    const updatedWaypoints = [...waypoints];
    
    // Find destination index and insert before it
    const destIndex = updatedWaypoints.findIndex(w => w.waypoint_type === 'destination');
    if (destIndex !== -1) {
      updatedWaypoints.splice(destIndex, 0, newWaypoint);
    } else {
      updatedWaypoints.push(newWaypoint);
    }

    // Recalculate sequence orders
    const reorderedWaypoints = reorderWaypoints(updatedWaypoints);
    
    setWaypoints(reorderedWaypoints);
    setNewLocationId("");
    onWaypointsChange?.(reorderedWaypoints);
  };

  const removeWaypoint = (index: number) => {
    const waypoint = waypoints[index];
    if (waypoint.waypoint_type === 'origin' || waypoint.waypoint_type === 'destination') {
      toast({ title: "Cannot remove", description: "Origin and destination cannot be removed", variant: "destructive" });
      return;
    }

    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    const reorderedWaypoints = reorderWaypoints(updatedWaypoints);
    
    setWaypoints(reorderedWaypoints);
    onWaypointsChange?.(reorderedWaypoints);
  };

  const moveWaypoint = (fromIndex: number, direction: 'up' | 'down') => {
    const waypoint = waypoints[fromIndex];
    if (waypoint.waypoint_type === 'origin' || waypoint.waypoint_type === 'destination') {
      return;
    }

    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    const targetWaypoint = waypoints[toIndex];

    // Can't move past origin or destination
    if (targetWaypoint.waypoint_type === 'origin' || targetWaypoint.waypoint_type === 'destination') {
      return;
    }

    const updatedWaypoints = [...waypoints];
    [updatedWaypoints[fromIndex], updatedWaypoints[toIndex]] = [updatedWaypoints[toIndex], updatedWaypoints[fromIndex]];
    
    const reorderedWaypoints = reorderWaypoints(updatedWaypoints);
    setWaypoints(reorderedWaypoints);
    onWaypointsChange?.(reorderedWaypoints);
  };

  const reorderWaypoints = (wps: Waypoint[]): Waypoint[] => {
    return wps.map((w, index) => ({
      ...w,
      sequence_order: w.waypoint_type === 'origin' ? 0 : 
                      w.waypoint_type === 'destination' ? 999 : 
                      index
    }));
  };

  const saveWaypoints = async () => {
    if (!tripId) return;
    
    setSaving(true);
    try {
      // Delete existing waypoints
      await supabase
        .from("trip_waypoints")
        .delete()
        .eq("trip_id", tripId);

      // Insert new waypoints (only stops, origin/dest are on trip)
      const stopsToInsert = waypoints
        .filter(w => w.waypoint_type === 'stop')
        .map((w, index) => ({
          trip_id: tripId,
          location_id: w.location_id,
          waypoint_name: w.waypoint_name,
          waypoint_type: w.waypoint_type,
          sequence_order: index + 1,
          status: w.status || 'pending'
        }));

      if (stopsToInsert.length > 0) {
        const { error } = await supabase
          .from("trip_waypoints")
          .insert(stopsToInsert);

        if (error) throw error;
      }

      toast({ title: "Success", description: "Waypoints saved successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Get available locations (exclude already selected ones)
  const availableLocations = locations.filter(
    l => !waypoints.some(w => w.location_id === l.id)
  );

  const getWaypointIcon = (type: string) => {
    switch (type) {
      case 'origin':
        return <Navigation className="h-4 w-4 text-green-500" />;
      case 'destination':
        return <MapPin className="h-4 w-4 text-red-500" />;
      default:
        return <MapPin className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reached':
        return <Badge variant="default" className="bg-green-600 text-xs">Reached</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600 text-xs">En Route</Badge>;
      case 'skipped':
        return <Badge variant="secondary" className="text-xs">Skipped</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Trip Waypoints
          <Badge variant="secondary">{waypoints.filter(w => w.waypoint_type === 'stop').length} stops</Badge>
        </CardTitle>
        <CardDescription>
          Manage intermediate stops for multi-pick/multi-drop trips
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Waypoint List */}
        <div className="space-y-2">
          {waypoints.map((waypoint, index) => (
            <div key={waypoint.id || `wp-${index}`}>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                {/* Drag Handle (only for stops) */}
                {waypoint.waypoint_type === 'stop' && !readOnly && (
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => moveWaypoint(index, 'up')}
                      disabled={index === 0 || waypoints[index - 1]?.waypoint_type === 'origin'}
                    >
                      <ArrowDown className="h-3 w-3 rotate-180" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => moveWaypoint(index, 'down')}
                      disabled={index === waypoints.length - 1 || waypoints[index + 1]?.waypoint_type === 'destination'}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                {/* Waypoint Icon */}
                <div className="flex-shrink-0">
                  {getWaypointIcon(waypoint.waypoint_type)}
                </div>

                {/* Waypoint Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{waypoint.waypoint_name}</span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {waypoint.waypoint_type}
                    </Badge>
                    {getStatusBadge(waypoint.status)}
                  </div>
                  {waypoint.location && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[waypoint.location.city, waypoint.location.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                {/* Sequence Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                  {waypoint.waypoint_type === 'origin' ? 'A' : 
                   waypoint.waypoint_type === 'destination' ? 'Z' : 
                   index}
                </div>

                {/* Remove Button (only for stops) */}
                {waypoint.waypoint_type === 'stop' && !readOnly && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeWaypoint(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove stop</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Connector Line */}
              {index < waypoints.length - 1 && (
                <div className="flex items-center justify-center py-1">
                  <div className="w-px h-4 bg-border" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Waypoint Section */}
        {!readOnly && (
          <div className="flex gap-2 pt-2 border-t">
            <Select value={newLocationId} onValueChange={setNewLocationId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a location to add as stop" />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No available locations</div>
                ) : (
                  availableLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.location_name}
                      {location.city && <span className="text-muted-foreground ml-1">({location.city})</span>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button onClick={addWaypoint} disabled={!newLocationId}>
              <Plus className="h-4 w-4 mr-1" />
              Add Stop
            </Button>
          </div>
        )}

        {/* Info Alert */}
        {waypoints.filter(w => w.waypoint_type === 'stop').length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Waypoints will be used for route optimization and ETA calculations. 
              Shipments will be automatically matched to compatible waypoints.
            </AlertDescription>
          </Alert>
        )}

        {/* Save Button (only if editing existing trip) */}
        {tripId && !readOnly && (
          <div className="flex justify-end pt-2">
            <Button onClick={saveWaypoints} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Waypoints
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}