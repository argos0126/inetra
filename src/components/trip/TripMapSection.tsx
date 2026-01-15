import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Flag, RefreshCw, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import polyline from "polyline-encoded";
import { hasTrackingPointNearLocation } from "@/utils/geoUtils";
import { clusterTrackingPoints, formatDuration, TrackingCluster } from "@/utils/trackingPointCluster";

export interface MapWaypoint {
  id: string;
  name: string;
  type: string;
  status: string;
  coords?: { lat: number; lng: number } | null;
}

export interface TrackingPoint {
  id: string;
  latitude: number;
  longitude: number;
  sequence_number: number;
  event_time: string;
  detailed_address?: string | null;
}

export interface TripAlertForMap {
  id: string;
  alert_type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  triggered_at: string;
  location_latitude?: number | null;
  location_longitude?: number | null;
}

interface TripMapSectionProps {
  originName: string;
  originCity?: string | null;
  destinationName: string;
  destinationCity?: string | null;
  originCoords?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
  currentLocation?: { lat: number; lng: number; heading?: number } | null;
  waypoints?: MapWaypoint[];
  trackingPoints?: TrackingPoint[];
  tripAlerts?: TripAlertForMap[];
  laneId?: string | null;
  isTracking?: boolean;
  onRefresh?: () => void;
  originGeofenceRadiusKm?: number | null;
  destinationGeofenceRadiusKm?: number | null;
  stoppageThresholdMinutes?: number;
  tripStatus?: string;
}

// Waypoint detection radius in meters (500m for SIM tracking accuracy)
const WAYPOINT_DETECTION_RADIUS = 500;

// Default clustering settings
const CLUSTERING_PROXIMITY_METERS = 100;
const DEFAULT_STOPPAGE_THRESHOLD_MINUTES = 30;

// Custom icon styles - Enhanced markers with SVG icons
const createOriginIcon = () => {
  return L.divIcon({
    className: 'custom-marker-origin',
    html: `<div style="
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg style="transform: rotate(45deg); width: 20px; height: 20px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [12, 40],
  });
};

const createDestinationIcon = () => {
  return L.divIcon({
    className: 'custom-marker-destination',
    html: `<div style="
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg style="transform: rotate(45deg); width: 20px; height: 20px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
      </svg>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [12, 40],
  });
};

const createWaypointIcon = (color: string, label: string, status: string) => {
  const bgColor = status === 'completed' ? '#22c55e' : 
                  status === 'current' ? '#f97316' : 
                  status === 'skipped' ? '#ef4444' : '#6b7280';
  
  return L.divIcon({
    className: 'custom-marker-waypoint',
    html: `<div style="
      width: 32px;
      height: 32px;
      background: ${bgColor};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 13px;
      font-weight: bold;
      font-family: system-ui, sans-serif;
    ">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createCurrentLocationIcon = (heading?: number) => {
  return L.divIcon({
    className: 'current-location-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      position: relative;
    ">
      <div style="
        position: absolute;
        width: 48px;
        height: 48px;
        top: -12px;
        left: -12px;
        background: rgba(59, 130, 246, 0.15);
        border-radius: 50%;
        animation: pulse 2s infinite;
      "></div>
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
        z-index: 1;
      "></div>
      ${heading !== undefined ? `
        <div style="
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%) rotate(${heading}deg);
          z-index: 2;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6">
            <path d="M12 2L19 21L12 17L5 21L12 2Z"/>
          </svg>
        </div>
      ` : ''}
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.5; }
        100% { transform: scale(1); opacity: 1; }
      }
    </style>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Truck icon for current/last tracked location
const createTruckIcon = () => {
  return L.divIcon({
    className: 'truck-location-marker',
    html: `<div style="
      width: 48px;
      height: 48px;
      position: relative;
    ">
      <div style="
        position: absolute;
        width: 56px;
        height: 56px;
        top: -4px;
        left: -4px;
        background: rgba(249, 115, 22, 0.2);
        border-radius: 50%;
        animation: truckPulse 2s infinite;
      "></div>
      <div style="
        position: relative;
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        border: 3px solid white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(249, 115, 22, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
          <path d="M1 3h15v13H1zM16 8h4l3 4v5h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5" fill="white" stroke="none"/>
          <circle cx="18.5" cy="18.5" r="2.5" fill="white" stroke="none"/>
        </svg>
      </div>
    </div>
    <style>
      @keyframes truckPulse {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.2); opacity: 0.4; }
        100% { transform: scale(1); opacity: 0.8; }
      }
    </style>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

// Location marker for tracking history points
const createTrackingPointIcon = (sequenceNumber: number, isFirst: boolean) => {
  const size = isFirst ? 28 : 22;
  const color = isFirst ? '#22c55e' : '#6366f1';
  const shadowColor = isFirst ? 'rgba(34, 197, 94, 0.4)' : 'rgba(99, 102, 241, 0.4)';
  
  return L.divIcon({
    className: 'tracking-point-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      position: relative;
    " title="Point ${sequenceNumber}">
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
        border: 2px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 8px ${shadowColor};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg style="transform: rotate(45deg); width: ${size * 0.5}px; height: ${size * 0.5}px; color: white;" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size * 0.3, size],
  });
};

// Stoppage cluster marker (orange/red for extended stops)
const createStoppageClusterIcon = (isLongStoppage: boolean) => {
  const color = isLongStoppage ? '#dc2626' : '#f97316';
  const shadowColor = isLongStoppage ? 'rgba(220, 38, 38, 0.4)' : 'rgba(249, 115, 22, 0.4)';
  const size = 32;
  
  return L.divIcon({
    className: 'stoppage-cluster-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      position: relative;
    ">
      <div style="
        position: absolute;
        width: ${size + 10}px;
        height: ${size + 10}px;
        top: -5px;
        left: -5px;
        background: ${shadowColor};
        border-radius: 50%;
        animation: stoppagePulse 2s infinite;
      "></div>
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 3px 10px ${shadowColor};
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      ">
        <svg style="width: 16px; height: 16px; color: white;" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="5" width="4" height="14" rx="1"/>
          <rect x="14" y="5" width="4" height="14" rx="1"/>
        </svg>
      </div>
    </div>
    <style>
      @keyframes stoppagePulse {
        0% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.3); opacity: 0.3; }
        100% { transform: scale(1); opacity: 0.6; }
      }
    </style>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Stationary cluster marker (muted, for short stops)
const createStationaryClusterIcon = () => {
  return L.divIcon({
    className: 'stationary-cluster-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg style="width: 12px; height: 12px; color: white;" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Alert marker icons based on alert type
const createAlertMarkerIcon = (alertType: string, severity: string) => {
  const colors: Record<string, { bg: string; shadow: string }> = {
    critical: { bg: '#dc2626', shadow: 'rgba(220, 38, 38, 0.5)' },
    high: { bg: '#ea580c', shadow: 'rgba(234, 88, 12, 0.5)' },
    medium: { bg: '#d97706', shadow: 'rgba(217, 119, 6, 0.5)' },
    low: { bg: '#0284c7', shadow: 'rgba(2, 132, 199, 0.5)' },
  };
  const { bg, shadow } = colors[severity] || colors.medium;
  
  const icons: Record<string, string> = {
    route_deviation: '<path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 6h2v4h-2V8zm0 6h2v2h-2v-2z"/>',
    stoppage: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    tracking_lost: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 014 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0120 12c0 4.42-3.58 8-8 8z"/>',
    delay_warning: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
    idle_time: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="white" stroke-width="2" fill="none"/>',
    consent_revoked: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>',
  };
  
  const iconPath = icons[alertType] || icons.delay_warning;
  
  return L.divIcon({
    className: `alert-marker alert-${alertType}`,
    html: `<div style="
      width: 32px;
      height: 32px;
      position: relative;
    ">
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        top: -4px;
        left: -4px;
        background: ${shadow};
        border-radius: 50%;
        animation: alertPulse 1.5s infinite;
      "></div>
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        background: ${bg};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 3px 10px ${shadow};
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      ">
        <svg style="width: 16px; height: 16px; color: white;" fill="currentColor" viewBox="0 0 24 24">
          ${iconPath}
        </svg>
      </div>
    </div>
    <style>
      @keyframes alertPulse {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.4); opacity: 0.3; }
        100% { transform: scale(1); opacity: 0.8; }
      }
    </style>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export function TripMapSection({
  originName,
  originCity,
  destinationName,
  destinationCity,
  originCoords,
  destinationCoords,
  currentLocation,
  waypoints = [],
  trackingPoints = [],
  tripAlerts = [],
  laneId,
  isTracking = false,
  onRefresh,
  originGeofenceRadiusKm,
  destinationGeofenceRadiusKm,
  stoppageThresholdMinutes = DEFAULT_STOPPAGE_THRESHOLD_MINUTES,
  tripStatus,
}: TripMapSectionProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circlesRef = useRef<L.Circle[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const trackingPolylineRef = useRef<L.Polyline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);
  const [snappedTrackingPath, setSnappedTrackingPath] = useState<[number, number][] | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);

  // Cluster tracking points by proximity
  const { clusters, movingPoints } = useMemo(() => {
    return clusterTrackingPoints(
      trackingPoints,
      CLUSTERING_PROXIMITY_METERS,
      stoppageThresholdMinutes
    );
  }, [trackingPoints, stoppageThresholdMinutes]);

  // Fetch lane route calculation for polyline
  useEffect(() => {
    const fetchLaneRoute = async (id: string) => {
      try {
        console.log("Fetching lane route for:", id);
        const { data, error } = await supabase
          .from("lane_route_calculations")
          .select("encoded_polyline, waypoints")
          .eq("lane_id", id)
          .maybeSingle();

        console.log("Lane route data:", data, "Error:", error);

        if (!error && data?.encoded_polyline) {
          // polyline-encoded returns array of [lat, lng] arrays
          const decoded = polyline.decode(data.encoded_polyline);
          console.log("Decoded polyline points:", decoded.length);
          setRoutePolyline(decoded as [number, number][]);
        }
      } catch (err) {
        console.error("Error fetching lane route:", err);
      }
    };

    if (laneId) {
      fetchLaneRoute(laneId);
    }
  }, [laneId]);

  // Snap tracking points to roads when they change
  const snapTrackingPointsToRoads = useCallback(async (points: TrackingPoint[]) => {
    if (points.length < 2) {
      setSnappedTrackingPath(null);
      return;
    }

    setIsSnapping(true);
    try {
      const sortedPoints = [...points].sort((a, b) => a.sequence_number - b.sequence_number);
      
      // Sample points if too many (to reduce API calls)
      let sampledPoints = sortedPoints;
      if (sortedPoints.length > 100) {
        const step = Math.floor(sortedPoints.length / 100);
        sampledPoints = sortedPoints.filter((_, index) => 
          index === 0 || index === sortedPoints.length - 1 || index % step === 0
        );
      }

      const pointsPayload = sampledPoints.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude
      }));

      console.log(`Snapping ${pointsPayload.length} tracking points to roads...`);

      const { data, error } = await supabase.functions.invoke('google-maps-snap-to-roads', {
        body: { points: pointsPayload }
      });

      if (error) {
        console.error('Error snapping to roads:', error);
        setSnappedTrackingPath(null);
        return;
      }

      if (data?.encodedPolyline) {
        const decoded = polyline.decode(data.encodedPolyline);
        console.log(`Snapped path has ${decoded.length} points`);
        setSnappedTrackingPath(decoded as [number, number][]);
      } else if (data?.snappedPoints && data.snappedPoints.length > 0) {
        // Handle both flat format (latitude, longitude) and nested format (location.latitude, location.longitude)
        const coords: [number, number][] = data.snappedPoints.map((p: any) => {
          const lat = p.latitude ?? p.location?.latitude;
          const lng = p.longitude ?? p.location?.longitude;
          return [lat, lng] as [number, number];
        });
        console.log(`Parsed ${coords.length} snapped points from API response`);
        setSnappedTrackingPath(coords);
      } else {
        console.log('No snapped path returned, using raw tracking');
        setSnappedTrackingPath(null);
      }
    } catch (err) {
      console.error('Failed to snap tracking points:', err);
      setSnappedTrackingPath(null);
    } finally {
      setIsSnapping(false);
    }
  }, []);

  // Trigger snap to roads when tracking points change
  useEffect(() => {
    if (trackingPoints.length >= 2) {
      snapTrackingPointsToRoads(trackingPoints);
    }
  }, [trackingPoints, snapTrackingPointsToRoads]);

  // Filter waypoints based on tracking proximity
  const getVisibleWaypoints = useCallback(() => {
    if (trackingPoints.length === 0) {
      // No tracking data yet, show all waypoints
      return waypoints;
    }

    // Filter to only show waypoints the vehicle has passed near
    return waypoints.filter(waypoint => {
      if (!waypoint.coords) return false;
      
      const { passed } = hasTrackingPointNearLocation(
        trackingPoints,
        waypoint.coords.lat,
        waypoint.coords.lng,
        WAYPOINT_DETECTION_RADIUS
      );
      
      return passed;
    }).map(waypoint => ({
      ...waypoint,
      status: 'completed' // Mark as completed since vehicle passed nearby
    }));
  }, [waypoints, trackingPoints]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Default center (India)
    const defaultCenter: [number, number] = [26.8, 80.9];
    const center = originCoords 
      ? [originCoords.lat, originCoords.lng] as [number, number]
      : defaultCenter;

    const map = L.map(mapRef.current, {
      center,
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
    setIsLoading(false);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers and route
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const visibleWaypoints = getVisibleWaypoints();

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Clear existing circles
    circlesRef.current.forEach(circle => circle.remove());
    circlesRef.current = [];

    // Clear existing polylines
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (trackingPolylineRef.current) {
      trackingPolylineRef.current.remove();
      trackingPolylineRef.current = null;
    }

    const bounds = L.latLngBounds([]);
    let hasValidBounds = false;

    // Add origin marker
    if (originCoords) {
      const originMarker = L.marker([originCoords.lat, originCoords.lng], {
        icon: createOriginIcon(),
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px;">
            <div style="font-weight: 600; color: #22c55e; margin-bottom: 4px;">📦 Origin</div>
            <div style="font-size: 14px; font-weight: 500;">${originName}</div>
            ${originCity ? `<div style="font-size: 12px; color: #6b7280;">${originCity}</div>` : ''}
          </div>
        `);
      markersRef.current.push(originMarker);
      bounds.extend([originCoords.lat, originCoords.lng]);
      hasValidBounds = true;

      // Add geofence circle around origin
      if (originGeofenceRadiusKm && originGeofenceRadiusKm > 0) {
        const geofenceCircle = L.circle([originCoords.lat, originCoords.lng], {
          radius: originGeofenceRadiusKm * 1000, // Convert km to meters
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 10',
        }).addTo(map);
        geofenceCircle.bindTooltip(`Geofence: ${originGeofenceRadiusKm} km radius`, {
          permanent: false,
          direction: 'center',
        });
        circlesRef.current.push(geofenceCircle);
      }
    }

    // Add waypoint markers (only visible ones based on tracking proximity) - hide when trip is 'created'
    if (tripStatus !== 'created') {
      visibleWaypoints.forEach((waypoint, index) => {
        if (!waypoint.coords) return;
        
        const marker = L.marker([waypoint.coords.lat, waypoint.coords.lng], {
          icon: createWaypointIcon('#6b7280', (index + 1).toString(), waypoint.status),
        })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui, sans-serif; padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">📍 Waypoint ${index + 1}</div>
              <div style="font-size: 14px; font-weight: 500;">${waypoint.name}</div>
              <div style="font-size: 12px; color: #6b7280; text-transform: capitalize;">${waypoint.status}</div>
            </div>
          `);
        
        markersRef.current.push(marker);
        bounds.extend([waypoint.coords.lat, waypoint.coords.lng]);
        hasValidBounds = true;
      });
    }

    // Add destination marker
    if (destinationCoords) {
      const destMarker = L.marker([destinationCoords.lat, destinationCoords.lng], {
        icon: createDestinationIcon(),
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px;">
            <div style="font-weight: 600; color: #ef4444; margin-bottom: 4px;">🏁 Destination</div>
            <div style="font-size: 14px; font-weight: 500;">${destinationName}</div>
            ${destinationCity ? `<div style="font-size: 12px; color: #6b7280;">${destinationCity}</div>` : ''}
          </div>
        `);
      markersRef.current.push(destMarker);
      bounds.extend([destinationCoords.lat, destinationCoords.lng]);
      hasValidBounds = true;

      // Add geofence circle around destination
      if (destinationGeofenceRadiusKm && destinationGeofenceRadiusKm > 0) {
        const destGeofenceCircle = L.circle([destinationCoords.lat, destinationCoords.lng], {
          radius: destinationGeofenceRadiusKm * 1000, // Convert km to meters
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.1,
          weight: 2,
          dashArray: '5, 10',
        }).addTo(map);
        destGeofenceCircle.bindTooltip(`Delivery Zone: ${destinationGeofenceRadiusKm} km radius`, {
          permanent: false,
          direction: 'center',
        });
        circlesRef.current.push(destGeofenceCircle);
      }
    }

    // Add current location marker (from prop) - legacy support
    if (currentLocation && trackingPoints.length === 0) {
      const currentMarker = L.marker([currentLocation.lat, currentLocation.lng], {
        icon: createCurrentLocationIcon(currentLocation.heading),
      })
        .addTo(map)
        .bindPopup('<strong>Current Location</strong>');
      markersRef.current.push(currentMarker);
      bounds.extend([currentLocation.lat, currentLocation.lng]);
      hasValidBounds = true;
    }

    // Add tracking history points and route
    if (trackingPoints.length > 0) {
      console.log("Processing", trackingPoints.length, "tracking points");
      const sortedPoints = [...trackingPoints].sort((a, b) => a.sequence_number - b.sequence_number);
      
      // Validation function for coordinates
      const validateCoords = (coords: [number, number][]) => coords.filter(coord => 
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === 'number' && 
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) && 
        !isNaN(coord[1]) &&
        coord[0] >= -90 && coord[0] <= 90 &&
        coord[1] >= -180 && coord[1] <= 180
      );
      
      // Get raw tracking coordinates from location history
      const rawFromPoints = sortedPoints.map(p => [p.latitude, p.longitude] as [number, number]);
      
      // Try snapped path first, fall back to raw if snapped fails validation
      let trackingCoords: [number, number][];
      
      if (snappedTrackingPath && snappedTrackingPath.length > 0) {
        console.log("Snapped path sample:", JSON.stringify(snappedTrackingPath.slice(0, 3)));
        const validSnapped = validateCoords(snappedTrackingPath);
        console.log("Valid snapped coords:", validSnapped.length, "of", snappedTrackingPath.length);
        
        if (validSnapped.length > 1) {
          trackingCoords = validSnapped;
        } else {
          // Snapped path failed, fall back to raw coords
          console.log("Snapped path invalid, falling back to raw tracking coords");
          trackingCoords = validateCoords(rawFromPoints);
        }
      } else {
        trackingCoords = validateCoords(rawFromPoints);
      }

      console.log("Final tracking coords:", trackingCoords.length);

      // Draw tracking route line (actual travelled path) with direction arrows
      if (trackingCoords.length > 1) {
        console.log("Drawing green tracking route with", trackingCoords.length, "points");
        // Draw outer stroke for better visibility
        const outerTrackingLine = L.polyline(trackingCoords, {
          color: '#166534', // Darker green border
          weight: 7,
          opacity: 0.9,
          smoothFactor: 1,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
        markersRef.current.push(outerTrackingLine as any);

        // Draw inner line
        trackingPolylineRef.current = L.polyline(trackingCoords, {
          color: '#22c55e', // Green for tracked path
          weight: 4,
          opacity: 1,
          smoothFactor: 1,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);

        // Add direction arrows at intervals along the tracking path
        const arrowInterval = Math.max(1, Math.floor(trackingCoords.length / 5)); // Show arrows at ~5 points
        for (let i = arrowInterval; i < trackingCoords.length; i += arrowInterval) {
          const prevPoint = trackingCoords[i - 1];
          const currPoint = trackingCoords[i];
          
          // Calculate bearing/direction
          const lat1 = prevPoint[0] * Math.PI / 180;
          const lat2 = currPoint[0] * Math.PI / 180;
          const dLng = (currPoint[1] - prevPoint[1]) * Math.PI / 180;
          const y = Math.sin(dLng) * Math.cos(lat2);
          const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
          const bearing = Math.atan2(y, x) * 180 / Math.PI;
          
          // Add arrow marker
          const arrowIcon = L.divIcon({
            className: 'direction-arrow',
            html: `<div style="
              transform: rotate(${bearing + 90}deg);
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-bottom: 12px solid #16a34a;
            "></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          
          const arrowMarker = L.marker(currPoint, { icon: arrowIcon, interactive: false }).addTo(map);
          markersRef.current.push(arrowMarker);
        }
      }

      // Render clustered tracking points - only show cluster markers, not individual points
      // Add cluster centers to bounds
      clusters.forEach(cluster => {
        bounds.extend([cluster.center.lat, cluster.center.lng]);
        hasValidBounds = true;
      });
      
      // Add bounds for the actual route path
      sortedPoints.forEach(point => {
        bounds.extend([point.latitude, point.longitude]);
        hasValidBounds = true;
      });

      // Render cluster markers (stationary & stoppage clusters)
      clusters.forEach((cluster) => {
        const startTimeStr = cluster.startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = cluster.endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = cluster.startTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const durationStr = formatDuration(cluster.durationMinutes);
        
        const isLongStoppage = cluster.durationMinutes >= 60; // Extra severity for 1+ hour stops
        
        // Build list of all point timestamps for stoppage tooltip
        const pointTimestamps = cluster.points
          .map(p => new Date(p.event_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
          .join(' → ');
        
        const tooltipContent = cluster.isStoppage
          ? `<div style="font-family: system-ui, sans-serif; font-size: 12px; max-width: 280px;">
              <div style="font-weight: 600; color: ${isLongStoppage ? '#dc2626' : '#f97316'}; margin-bottom: 4px;">
                ⏸ Stoppage: ${durationStr}
              </div>
              <div style="font-weight: 500; color: #374151; margin-bottom: 4px;">${startTimeStr} - ${endTimeStr} • ${dateStr}</div>
              ${cluster.address ? `<div style="color: #6b7280; margin-bottom: 4px;">${cluster.address}</div>` : ''}
              <div style="color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 4px; margin-top: 4px;">
                <div style="font-weight: 500; margin-bottom: 2px;">${cluster.points.length} points:</div>
                <div style="word-break: break-word; line-height: 1.4;">${pointTimestamps}</div>
              </div>
            </div>`
          : `<div style="font-family: system-ui, sans-serif; font-size: 12px; max-width: 220px;">
              <div style="font-weight: 500; color: #374151;">${startTimeStr} - ${endTimeStr} • ${dateStr}</div>
              <div style="color: #6b7280; margin-top: 2px;">Stationary: ${durationStr}</div>
              ${cluster.address ? `<div style="color: #6b7280; margin-top: 2px;">${cluster.address}</div>` : ''}
            </div>`;
        
        const icon = cluster.isStoppage 
          ? createStoppageClusterIcon(isLongStoppage)
          : createStationaryClusterIcon();
        
        const marker = L.marker([cluster.center.lat, cluster.center.lng], {
          icon,
          zIndexOffset: cluster.isStoppage ? 500 : 100,
        })
          .addTo(map)
          .bindTooltip(tooltipContent, {
            permanent: false,
            direction: 'top',
            offset: [0, -15],
            className: cluster.isStoppage ? 'stoppage-tooltip' : 'tracking-tooltip',
          });
        markersRef.current.push(marker);
      });

      // Add truck icon for the last (current) location
      const lastPoint = sortedPoints[sortedPoints.length - 1];
      const truckMarker = L.marker([lastPoint.latitude, lastPoint.longitude], {
        icon: createTruckIcon(),
        zIndexOffset: 1000, // Ensure truck is on top
      })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px;">
            <div style="font-weight: 600; color: #f97316; margin-bottom: 4px;">🚚 Current Location</div>
            <div style="font-size: 12px; color: #6b7280;">${new Date(lastPoint.event_time).toLocaleString()}</div>
            ${lastPoint.detailed_address ? `<div style="font-size: 12px; margin-top: 4px;">${lastPoint.detailed_address}</div>` : ''}
          </div>
        `);
      markersRef.current.push(truckMarker);
      bounds.extend([lastPoint.latitude, lastPoint.longitude]);
      hasValidBounds = true;
    }

    // Render alert markers on the map
    tripAlerts.forEach((alert) => {
      if (alert.location_latitude && alert.location_longitude) {
        const triggeredDate = new Date(alert.triggered_at);
        const timeStr = triggeredDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const dateStr = triggeredDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        
        const severityColors: Record<string, string> = {
          critical: '#dc2626',
          high: '#ea580c',
          medium: '#d97706',
          low: '#0284c7',
        };
        const color = severityColors[alert.severity] || severityColors.medium;
        
        const tooltipContent = `
          <div style="font-family: system-ui, sans-serif; font-size: 12px; max-width: 240px;">
            <div style="font-weight: 600; color: ${color}; margin-bottom: 4px;">
              ⚠ ${alert.title}
            </div>
            <div style="color: #6b7280; margin-bottom: 4px;">${alert.description}</div>
            <div style="font-weight: 500; color: #374151;">${timeStr} • ${dateStr}</div>
            <div style="color: #9ca3af; font-size: 11px; margin-top: 4px; text-transform: capitalize;">
              ${alert.severity} • ${alert.status}
            </div>
          </div>
        `;
        
        const marker = L.marker([alert.location_latitude, alert.location_longitude], {
          icon: createAlertMarkerIcon(alert.alert_type, alert.severity),
          zIndexOffset: 800, // Above clusters, below truck
        })
          .addTo(map)
          .bindTooltip(tooltipContent, {
            permanent: false,
            direction: 'top',
            offset: [0, -15],
            className: 'alert-tooltip',
          });
        markersRef.current.push(marker);
        bounds.extend([alert.location_latitude, alert.location_longitude]);
        hasValidBounds = true;
      }
    });

    // Draw planned route polyline (from lane calculation) - Google Maps style
    let routeDrawn = false;
    if (routePolyline && routePolyline.length > 0) {
      console.log("Route polyline has", routePolyline.length, "points, validating...");
      
      // Validate route polyline coordinates
      const validRoutePolyline = routePolyline.filter(coord => 
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === 'number' && 
        typeof coord[1] === 'number' &&
        !isNaN(coord[0]) && 
        !isNaN(coord[1]) &&
        coord[0] >= -90 && coord[0] <= 90 &&
        coord[1] >= -180 && coord[1] <= 180
      );

      console.log("Valid route polyline has", validRoutePolyline.length, "points after filtering");

      if (validRoutePolyline.length > 1) {
        console.log("Drawing polyline with", validRoutePolyline.length, "points");
        
        // Draw outer stroke (border effect like Google Maps)
        const outerLine = L.polyline(validRoutePolyline, {
          color: '#1a237e', // Very dark blue border
          weight: 8,
          opacity: 0.9,
          smoothFactor: 1,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
        
        // Draw inner line (main route color like Google Maps)
        polylineRef.current = L.polyline(validRoutePolyline, {
          color: '#4285f4', // Google Maps blue
          weight: 5,
          opacity: 1,
          smoothFactor: 1,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
        
        // Store outer line for cleanup
        markersRef.current.push(outerLine as any);
        
        validRoutePolyline.forEach(point => {
          bounds.extend(point);
          hasValidBounds = true;
        });
        
        routeDrawn = true;
      } else {
        console.warn("Not enough valid polyline points, falling back to straight line");
      }
    }
    
    // Fallback: draw straight line if no route polyline available
    if (!routeDrawn && originCoords && destinationCoords) {
      console.log("No polyline, drawing fallback straight line");
      // Fallback: draw straight line between origin, waypoints, and destination
      const routePoints: [number, number][] = [
        [originCoords.lat, originCoords.lng],
        ...visibleWaypoints
          .filter(w => w.coords)
          .map(w => [w.coords!.lat, w.coords!.lng] as [number, number]),
        [destinationCoords.lat, destinationCoords.lng],
      ];

      polylineRef.current = L.polyline(routePoints, {
        color: '#f97316',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10',
      }).addTo(map);
    }

    // Fit bounds
    if (hasValidBounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [originCoords, destinationCoords, currentLocation, waypoints, trackingPoints, tripAlerts, clusters, movingPoints, routePolyline, snappedTrackingPath, originName, originCity, destinationName, destinationCity, getVisibleWaypoints, originGeofenceRadiusKm, tripStatus]);

  return (
    <Card className="overflow-hidden border-2 border-primary/20">
      <CardContent className="p-0 relative">
        {/* Map container */}
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <div ref={mapRef} className="h-[350px] w-full" style={{ zIndex: 0 }} />

          {/* Title overlay */}
          <div className="absolute top-4 left-4 z-[1000]">
            <h3 className="text-lg font-semibold text-foreground bg-background/90 px-3 py-1.5 rounded-md shadow-sm flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              Live Trip Tracking
              {isTracking && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
              {isSnapping && (
                <span className="text-xs text-muted-foreground ml-2">(snapping route...)</span>
              )}
            </h3>
          </div>

          {/* Refresh button */}
          {onRefresh && (
            <div className="absolute top-4 right-4 z-[1000]">
              <Button
                size="icon"
                variant="secondary"
                className="h-9 w-9 rounded-full shadow-md"
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-14 right-4 z-[1000] bg-background/95 p-2 rounded-md shadow-sm text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
              <span>Origin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
              <span>Destination</span>
            </div>
            {routePolyline && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-blue-500 rounded"></div>
                <span>Planned Route</span>
              </div>
            )}
            {trackingPoints.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-green-500 rounded"></div>
                  <span>Actual Route</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-orange-500 border border-white"></div>
                  <span>Vehicle</span>
                </div>
                {clusters.some(c => c.isStoppage) && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-600 border border-white"></div>
                    <span>Stoppage</span>
                  </div>
                )}
                {clusters.some(c => !c.isStoppage) && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 border border-white"></div>
                    <span>Stationary</span>
                  </div>
                )}
              </>
            )}
            {tripAlerts.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-white animate-pulse"></div>
                <span>Alert</span>
              </div>
            )}
            {currentLocation && trackingPoints.length === 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
                <span>Current</span>
              </div>
            )}
          </div>

          {/* Origin badge */}
          <div className="absolute bottom-4 left-4 z-[1000]">
            <Badge className="bg-green-600 text-white px-3 py-1.5 text-sm shadow-lg">
              <Truck className="h-4 w-4 mr-2" />
              {originName}{originCity ? `, ${originCity}` : ""}
            </Badge>
          </div>

          {/* Destination badge */}
          <div className="absolute bottom-4 right-4 z-[1000]">
            <Badge className="bg-red-600 text-white px-3 py-1.5 text-sm shadow-lg">
              <Flag className="h-4 w-4 mr-2" />
              {destinationName}{destinationCity ? `, ${destinationCity}` : ""}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
