import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Route, Loader2, MapPin, Navigation, Clock, Ruler, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface RouteData {
  encodedPolyline: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  routeSummary: string;
  routeIndex?: number;
  waypointCoordinates?: Array<{ lat: number; lng: number; name: string }>;
}

export interface LocationCoords {
  lat: number;
  lng: number;
  name: string;
}

interface LaneRouteCalculatorProps {
  origin?: LocationCoords;
  destination?: LocationCoords;
  waypoints?: LocationCoords[];
  onRouteCalculated: (data: RouteData) => void;
  onMultipleRoutesFound?: (routes: RouteData[]) => void;
  initialRouteData?: RouteData | null;
  showMultiRouteSelection?: boolean;
}

export const LaneRouteCalculator = ({
  origin,
  destination,
  waypoints = [],
  onRouteCalculated,
  onMultipleRoutesFound,
  initialRouteData,
  showMultiRouteSelection = true,
}: LaneRouteCalculatorProps) => {
  const { toast } = useToast();
  
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(initialRouteData || null);
  const [allRoutes, setAllRoutes] = useState<RouteData[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  // Calculate route via backend edge function
  const calculateRoute = async () => {
    if (!origin || !destination) {
      toast({ title: "Please select origin and destination locations", variant: "destructive" });
      return;
    }

    setIsCalculating(true);
    setAllRoutes([]);

    try {
      console.log("Calling google-maps-route edge function with alternatives...");
      
      const { data, error } = await supabase.functions.invoke('google-maps-route', {
        body: {
          origin: { lat: origin.lat, lng: origin.lng, name: origin.name },
          destination: { lat: destination.lat, lng: destination.lng, name: destination.name },
          waypoints: waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng, name: wp.name })),
          alternatives: showMultiRouteSelection, // Request alternatives when multi-route selection is enabled
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Failed to calculate route");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Failed to calculate route");
      }

      // Handle multiple routes
      if (data.routes && data.routes.length > 0) {
        setAllRoutes(data.routes);
        setSelectedRouteIndex(0);
        setRouteData(data.routes[0]);
        onRouteCalculated(data.routes[0]);
        
        if (data.routes.length > 1 && onMultipleRoutesFound) {
          onMultipleRoutesFound(data.routes);
        }
        
        toast({ 
          title: `${data.routes.length} route${data.routes.length > 1 ? 's' : ''} found`,
          description: data.routes.length > 1 ? "Select routes to save as separate lanes" : undefined
        });
      } else if (data.data) {
        // Single route response (backward compatibility)
        const singleRoute = data.data;
        setAllRoutes([singleRoute]);
        setSelectedRouteIndex(0);
        setRouteData(singleRoute);
        onRouteCalculated(singleRoute);
        toast({ title: "Route calculated successfully" });
      }

    } catch (error: any) {
      console.error("Route calculation error:", error);
      toast({ 
        title: "Failed to calculate route", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleRouteSelect = (index: number) => {
    setSelectedRouteIndex(index);
    const selectedRoute = allRoutes[index];
    setRouteData(selectedRoute);
    onRouteCalculated(selectedRoute);
  };

  const formatDistance = (meters: number) => {
    return (meters / 1000).toFixed(1) + " km";
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const canCalculate = origin && destination;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          Route Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location Summary */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Origin</p>
              <p className="text-sm font-medium truncate">{origin?.name || "Not selected"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="text-sm font-medium truncate">{destination?.name || "Not selected"}</p>
            </div>
          </div>
        </div>

        {/* Calculate Button */}
        <Button
          type="button"
          onClick={calculateRoute}
          disabled={!canCalculate || isCalculating}
          className="w-full"
        >
          {isCalculating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finding Routes...
            </>
          ) : (
            <>
              <Navigation className="mr-2 h-4 w-4" />
              Calculate Routes (DRIVING)
            </>
          )}
        </Button>

        {/* Multiple Routes Selection */}
        {allRoutes.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {allRoutes.length} alternative routes found - select routes to save:
            </p>
            <div className="space-y-2">
              {allRoutes.map((route, index) => (
                <div
                  key={index}
                  onClick={() => handleRouteSelect(index)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    selectedRouteIndex === index 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold",
                    selectedRouteIndex === index 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {selectedRouteIndex === index ? <Check className="h-3 w-3" /> : index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      via {route.routeSummary || `Route ${index + 1}`}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3" />
                        {formatDistance(route.totalDistanceMeters)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(route.totalDurationSeconds)}
                      </span>
                      {route.waypointCoordinates && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {route.waypointCoordinates.length} waypoints
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Route Results */}
        {routeData && allRoutes.length <= 1 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Ruler className="h-3 w-3" />
              {formatDistance(routeData.totalDistanceMeters)}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(routeData.totalDurationSeconds)}
            </Badge>
            {routeData.routeSummary && (
              <Badge variant="outline" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                via {routeData.routeSummary}
              </Badge>
            )}
            {routeData.waypointCoordinates && routeData.waypointCoordinates.length > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                {routeData.waypointCoordinates.length} waypoints
              </Badge>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Route calculated via Google Maps Directions API. Distance and TAT will be auto-populated.
        </p>
      </CardContent>
    </Card>
  );
};
