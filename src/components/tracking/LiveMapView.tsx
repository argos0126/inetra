/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, MapPin, AlertCircle } from "lucide-react";

interface LocationPoint {
  id: string;
  name: string;
  type: "vehicle" | "driver" | "asset";
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp?: string;
  status?: "active" | "idle" | "offline";
}

interface LiveMapViewProps {
  locations?: LocationPoint[];
  center?: { lat: number; lng: number };
  zoom?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onLocationClick?: (location: LocationPoint) => void;
}

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export function LiveMapView({
  locations = [],
  center = { lat: 20.5937, lng: 78.9629 }, // India center
  zoom = 5,
  autoRefresh = false,
  refreshInterval = 30000,
  onLocationClick,
}: LiveMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      initializeMap();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => initializeMap();
    script.onerror = () => setError("Failed to load Google Maps");
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;

    try {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });
      setIsLoading(false);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Failed to initialize map");
      setIsLoading(false);
    }
  }, [center, zoom]);

  // Update markers when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (locations.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    locations.forEach((location) => {
      const position = { lat: location.latitude, lng: location.longitude };
      
      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: location.name,
        icon: getMarkerIcon(location.type, location.status),
      });

      // Create info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 150px;">
            <h3 style="margin: 0 0 8px 0; font-weight: 600;">${location.name}</h3>
            <p style="margin: 0; color: #666; font-size: 12px;">
              ${location.type.charAt(0).toUpperCase() + location.type.slice(1)}
            </p>
            ${location.speed !== undefined ? `<p style="margin: 4px 0 0 0; font-size: 12px;">Speed: ${location.speed} km/h</p>` : ""}
            ${location.timestamp ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #888;">Updated: ${new Date(location.timestamp).toLocaleTimeString()}</p>` : ""}
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(mapInstanceRef.current, marker);
        onLocationClick?.(location);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // Fit map to show all markers
    if (locations.length > 1) {
      mapInstanceRef.current.fitBounds(bounds);
    } else if (locations.length === 1) {
      mapInstanceRef.current.setCenter({
        lat: locations[0].latitude,
        lng: locations[0].longitude,
      });
      mapInstanceRef.current.setZoom(14);
    }

    setLastUpdated(new Date());
  }, [locations, onLocationClick]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const handleRefresh = () => {
    setLastUpdated(new Date());
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Live Map View</CardTitle>
          {locations.length > 0 && (
            <Badge variant="secondary">{locations.length} locations</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="flex items-center justify-center h-[400px] bg-muted/50">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 text-destructive" />
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <div ref={mapRef} className="h-[400px] w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getMarkerIcon(
  type: "vehicle" | "driver" | "asset",
  status?: "active" | "idle" | "offline"
): any {
  const colors = {
    active: "#22c55e",
    idle: "#f59e0b",
    offline: "#6b7280",
  };
  const color = colors[status || "active"];

  if (!window.google?.maps) return null;

  return {
    path: type === "vehicle" 
      ? "M12 2L4 12l1.5 1.5L12 22l6.5-8.5L20 12z"
      : window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: type === "vehicle" ? 1.5 : 10,
    anchor: type === "vehicle" 
      ? new window.google.maps.Point(12, 22)
      : new window.google.maps.Point(0, 0),
  };
}
