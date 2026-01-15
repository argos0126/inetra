import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, RefreshCw, Loader2, Navigation, Gauge } from "lucide-react";
import { useTelenityTracking } from "@/hooks/useTelenityTracking";
import { useWheelseyeTracking } from "@/hooks/useWheelseyeTracking";

interface LocationTrackerProps {
  trackingType: "sim" | "gps";
  // For SIM tracking
  msisdn?: string;
  driverId?: string;
  // For GPS tracking
  vehicleNumber?: string;
  vehicleId?: string;
  trackingAssetId?: string;
  // Common
  tripId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export function LocationTracker({
  trackingType,
  msisdn,
  driverId,
  vehicleNumber,
  vehicleId,
  trackingAssetId,
  tripId,
  autoRefresh = false,
  refreshInterval = 60,
}: LocationTrackerProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const telenity = useTelenityTracking();
  const wheelseye = useWheelseyeTracking();

  const loading = telenity.loading || wheelseye.loading;

  const fetchLocation = async () => {
    setError(null);
    try {
      let data;
      if (trackingType === "sim" && msisdn) {
        data = await telenity.getLocation({ msisdn, tripId, driverId });
      } else if (trackingType === "gps" && vehicleNumber) {
        data = await wheelseye.getLocation({ vehicleNumber, tripId, vehicleId, trackingAssetId });
      } else {
        throw new Error("Missing required parameters for tracking");
      }

      setLocation({
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy || data.accuracy_meters,
        speed: data.speed,
        heading: data.heading,
        timestamp: data.timestamp,
      });
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Initial fetch on mount or when tracking params change
  useEffect(() => {
    const hasRequiredParams = (trackingType === "sim" && msisdn) || (trackingType === "gps" && vehicleNumber);
    if (hasRequiredParams) {
      fetchLocation();
    }
  }, [trackingType, msisdn, vehicleNumber, tripId, driverId, vehicleId, trackingAssetId]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    
    const hasRequiredParams = (trackingType === "sim" && msisdn) || (trackingType === "gps" && vehicleNumber);
    if (!hasRequiredParams) return;

    const interval = setInterval(fetchLocation, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, trackingType, msisdn, vehicleNumber, tripId, driverId, vehicleId, trackingAssetId]);

  const formatCoordinate = (coord: number) => coord.toFixed(6);
  const formatSpeed = (speed: number) => `${speed.toFixed(1)} km/h`;
  const formatHeading = (heading: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(heading / 45) % 8;
    return `${directions[index]} (${heading.toFixed(0)}°)`;
  };

  const openInMaps = () => {
    if (!location) return;
    window.open(
      `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
      "_blank"
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Live Location
          <Badge variant={trackingType === "sim" ? "secondary" : "default"}>
            {trackingType.toUpperCase()}
          </Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchLocation} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-destructive text-sm mb-4">
            Error: {error}
          </div>
        )}

        {location ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-muted-foreground text-sm">Latitude</span>
                <p className="font-mono">{formatCoordinate(location.latitude)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Longitude</span>
                <p className="font-mono">{formatCoordinate(location.longitude)}</p>
              </div>
              {location.speed !== undefined && (
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground text-sm">Speed</span>
                    <p className="font-medium">{formatSpeed(location.speed)}</p>
                  </div>
                </div>
              )}
              {location.heading !== undefined && (
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground text-sm">Heading</span>
                    <p className="font-medium">{formatHeading(location.heading)}</p>
                  </div>
                </div>
              )}
            </div>

            {location.accuracy && (
              <div className="text-sm text-muted-foreground">
                Accuracy: ±{location.accuracy}m
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Last updated: {lastUpdated?.toLocaleTimeString()}
              </span>
              <Button variant="link" size="sm" onClick={openInMaps}>
                Open in Maps
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Click refresh to fetch current location</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
